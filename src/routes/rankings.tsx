import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPlayerRanking } from "@/lib/club-data";
import { RankedPlayerRow } from "@/components/ranked-player-row";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABEL, CATEGORY_LABEL_EU } from "@/lib/fantasy/types";
import { useT, useLang } from "@/lib/i18n";
import { JornadaBar, useCalendarJornadas, type JornadaSel } from "@/components/jornada-bar";

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
  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ["player-ranking"],
    queryFn: fetchPlayerRanking,
  });
  const [category, setCategory] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [tab, setTab] = useState<"jugadores" | "usuarios">("jugadores");
  const [jor, setJor] = useState<JornadaSel>("total");
  const { data: jornadas = [] } = useCalendarJornadas();

  const allTeams = [...new Map(ranking.flatMap((r) => (r.team ? [[r.team.id, r.team]] : []))).values()].sort((a, b) =>
    a.nombre.localeCompare(b.nombre),
  );
  const teams = allTeams.filter((tm) => (!category || tm.categoria === category) && (!gender || tm.sexo === gender));
  const catOptions = (["cadete", "juvenil", "senior"] as const).filter((k) =>
    allTeams.some((tm) => tm.categoria === k && (!gender || tm.sexo === gender)),
  );
  const genderOptions = (["masculino", "femenino"] as const).filter((g) =>
    allTeams.some((tm) => tm.sexo === g && (!category || tm.categoria === category)),
  );
  useEffect(() => {
    if (teamId && !teams.some((tm) => tm.id === teamId)) setTeamId("");
  }, [category, gender, teamId, teams]);
  const sorted = ranking
    .filter(
      (r) =>
        (!category || r.team?.categoria === category) &&
        (!gender || r.team?.sexo === gender) &&
        (!teamId || r.team?.id === teamId),
    )
    .map((r) => (jor === "total" ? r : { ...r, puntos: r.porJornada[jor] ?? 0, jornadas: r.porJornada[jor] ? 1 : 0 }))
    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton />
      <div className="mt-3">
        <h1 className="font-display text-4xl">{t("Sailkapenak", "Rankings")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Klubeko Fantasy puntu onenak.", "Los mejores puntos Fantasy del club.")}
        </p>
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

      <div className="mt-4">
        <JornadaBar jornadas={jornadas} value={jor} onChange={setJor} />
      </div>

      {tab === "usuarios" ? (
        <UsuariosRanking jor={jor} />
      ) : (
        <>
          <h2 className="sr-only">{t("Jokalarien sailkapena", "Ranking de jugadores/as")}</h2>
          <div className="mt-6 grid grid-cols-1 gap-2 rounded-2xl border border-border bg-card p-3 shadow-card sm:grid-cols-3">
            <Select value={category} onChange={setCategory} label={t("Kategoria", "Categoría")}>
              <option value="">{t("Guztiak", "Todas")}</option>
              {catOptions.map((k) => (
                <option key={k} value={k}>
                  {CAT_LABEL[k]}
                </option>
              ))}
            </Select>
            <Select value={gender} onChange={setGender} label={t("Sexua", "Sexo")}>
              <option value="">{t("Guztiak", "Todos")}</option>
              {genderOptions.includes("masculino") && <option value="masculino">{t("Gizonezkoa", "Masculino")}</option>}
              {genderOptions.includes("femenino") && <option value="femenino">{t("Emakumezkoa", "Femenino")}</option>}
            </Select>
            <Select value={teamId} onChange={setTeamId} label={t("Taldea", "Equipo")}>
              <option value="">{t("Guztiak", "Todos")}</option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.nombre}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-6 space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">{t("Kargatzen…", "Cargando…")}</p>}
            {sorted.map((p, i) => (
              <RankedPlayerRow key={p.id} p={p} rank={i + 1} />
            ))}
            {!isLoading && sorted.length === 0 && (
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

function UsuariosRanking({ jor }: { jor: JornadaSel }) {
  const t = useT();
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["user-ranking"],
    queryFn: async () => {
      const [tot, por] = await Promise.all([supabase.rpc("user_ranking"), supabase.rpc("user_ranking_by_jornada")]);
      if (tot.error) throw tot.error;
      if (por.error) throw por.error;
      const porUser: Record<string, Record<number, number>> = {};
      for (const r of por.data ?? []) {
        (porUser[r.user_id] ??= {})[r.jornada] = Number(r.puntos);
      }
      return (tot.data ?? []).map((r) => ({
        userId: r.user_id as string,
        nombre: (r.username as string | null) ?? (r.display_name as string | null) ?? t("Erabiltzailea", "Usuario"),
        puntos: Math.round(Number(r.puntos) * 100) / 100,
        jornadas: Number(r.jornadas),
        porJornada: porUser[r.user_id] ?? {},
      }));
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("user-ranking-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "player_jornada_stats" }, () => {
        queryClient.invalidateQueries({ queryKey: ["user-ranking"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lineups" }, () => {
        queryClient.invalidateQueries({ queryKey: ["user-ranking"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const rows = (q.data ?? [])
    .map((u) =>
      jor === "total"
        ? u
        : {
            ...u,
            puntos: Math.round((u.porJornada[jor] ?? 0) * 100) / 100,
            jornadas: jor in u.porJornada ? 1 : 0,
          },
    )
    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre));

  return (
    <div className="mt-6">
      <p className="text-sm text-muted-foreground">
        {t(
          "Erabiltzaile bakoitzak jardunaldi bakoitzean lerrokatutako 7 jokalarien puntuak batzen ditu.",
          "Cada usuario suma los puntos de los 7 jugadores/as que alineó en cada jornada.",
        )}
      </p>
      {q.isLoading && <p className="mt-6 text-sm text-muted-foreground">{t("Kargatzen…", "Cargando…")}</p>}
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
              <div className="font-display text-2xl text-primary">{String(u.puntos).replace(".", ",")}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">pts</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
