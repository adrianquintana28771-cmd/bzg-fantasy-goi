import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/partidos/")({
  head: () => {
    const title = "Partidos y jornadas | BZG Fantasy Eskubaloia";
    const description =
      "Calendario y resultados por jornada de los equipos de balonmano del club BZG Etxebarri: rival, fecha, hora y marcador.";
    const url = "https://bzg-fantasy-goi.lovable.app/partidos";
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
  component: Partidos,
});

type Match = {
  id: string;
  jornada: number;
  rival: string;
  fecha: string;
  hora: string | null;
  es_local: boolean;
  goles_favor: number;
  goles_contra: number;
  club_teams: { nombre: string; categoria: string; sexo: string } | null;
};

const CAT_ORDER: Record<string, number> = { senior: 0, juvenil: 1, cadete: 2 };

function Partidos() {
  const t = useT();
  const { data = [], isLoading } = useQuery({
    queryKey: ["partidos-publicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_matches")
        .select(
          "id,jornada,rival,fecha,hora,es_local,goles_favor,goles_contra,club_teams(nombre,categoria,sexo)",
        )
        .order("jornada");
      if (error) throw error;
      return (data ?? []) as unknown as Match[];
    },
  });

  const jornadas = useMemo(
    () => [...new Set(data.map((m) => m.jornada))].sort((a, b) => a - b),
    [data],
  );
  const [jor, setJor] = useState<number | null>(null);

  useEffect(() => {
    if (jor !== null || !jornadas.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const next = data
      .filter((m) => m.fecha >= today)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    setJor(next?.jornada ?? jornadas[jornadas.length - 1]);
  }, [jornadas, data, jor]);

  const list = data
    .filter((m) => m.jornada === jor)
    .sort(
      (a, b) =>
        (CAT_ORDER[a.club_teams?.categoria ?? ""] ?? 9) -
          (CAT_ORDER[b.club_teams?.categoria ?? ""] ?? 9) ||
        (a.club_teams?.sexo ?? "").localeCompare(b.club_teams?.sexo ?? ""),
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <BackButton />
      <h1 className="mt-3 font-display text-4xl">{t("Partidak", "Partidos")}</h1>
      <p className="text-sm text-muted-foreground">
        {t(
          "Aukeratu jardunaldia eta ikusi talde bakoitzaren partida.",
          "Elige la jornada y mira el partido de cada equipo.",
        )}
      </p>

      <h2 className="sr-only">{t("Jardunaldiak", "Jornadas")}</h2>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {jornadas.map((j) => (
          <button
            key={j}
            onClick={() => setJor(j)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              j === jor
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {t("J", "J")}
            {j}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground">{t("Kargatzen…", "Cargando…")}</p>
        )}
        {!isLoading && list.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("Ez dago partidarik.", "No hay partidos.")}
          </p>
        )}
        {list.map((m) => {
          const team = m.club_teams?.nombre ?? "BZG";
          const played = m.goles_favor + m.goles_contra > 0;
          const rest = m.rival.toLowerCase() === "descansa";
          const [y, mo, d] = m.fecha.split("-");
          return (
            <div key={m.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    {`${d}/${mo}/${y}`}
                    {m.hora ? ` · ${m.hora}` : ""}
                    {rest ? "" : " · "}
                    {rest ? "" : m.es_local ? t("Etxean", "Local") : t("Kanpoan", "Visitante")}
                  </div>
                  <div className="mt-1 font-semibold">
                    {rest
                      ? `${team} · ${t("Atseden", "Descansa")}`
                      : m.es_local
                        ? `${team} vs ${m.rival}`
                        : `${m.rival} vs ${team}`}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {m.club_teams?.categoria} · {m.club_teams?.sexo}
                  </div>
                </div>
                <div className="text-right font-display text-3xl leading-none">
                  {played
                    ? m.es_local
                      ? `${m.goles_favor}-${m.goles_contra}`
                      : `${m.goles_contra}-${m.goles_favor}`
                    : "–"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
