import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Users, Shield, ArrowRight, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchPlayerRanking, round2, type RankedPlayer } from "@/lib/club-data";
import { RankedPlayerRow } from "@/components/ranked-player-row";
import { CategoryBadge } from "@/components/fantasy-ui";
import { CATEGORY_LABEL, CATEGORY_LABEL_EU } from "@/lib/fantasy/types";
import { useT, useLang } from "@/lib/i18n";

const SITE = "https://bzg-fantasy-goi.lovable.app";
const HOME_TITLE = "BZG Fantasy Eskubaloia | Fantasy de balonmano de Etxebarri";
const HOME_DESC =
  "BZG Fantasy Eskubaloia: sigue los rankings, jugadores, equipos, partidos y estadísticas del fantasy de balonmano de Etxebarri.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESC },
    ],
    links: [{ rel: "canonical", href: `${SITE}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SportsOrganization",
          name: "BZG Etxebarri · Berdezurigorri",
          sport: "Balonmano",
          url: SITE,
          areaServed: "Etxebarri, Bizkaia",
          description: HOME_DESC,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "BZG Fantasy Eskubaloia",
          url: SITE,
          inLanguage: "es-ES",
        }),
      },
    ],
  }),
  component: Home,
});

function Home() {
  const t = useT();
  const { lang } = useLang();
  const CAT_LABEL = lang === "eu" ? CATEGORY_LABEL_EU : CATEGORY_LABEL;
  const { data: ranking = [] } = useQuery({
    queryKey: ["player-ranking"],
    queryFn: fetchPlayerRanking,
  });
  const { data: matches = [] } = useQuery({
    queryKey: ["home-next-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_matches")
        .select("id,jornada,rival,fecha,hora,es_local,club_teams(nombre)")
        .gte("fecha", new Date().toISOString().slice(0, 10))
        .neq("rival", "Descansa")
        .order("fecha")
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });
  // Última jornada con alineaciones cerradas (is_locked), no el cierre de jornada.
  const { data: lockedJornadas = [] } = useQuery({
    queryKey: ["home-locked-jornadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jornadas")
        .select("numero")
        .eq("is_locked", true)
        .order("numero", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data ?? [];
    },
  });
  const jornadaNum = lockedJornadas[0]?.numero as number | undefined;
  const top5 = ranking.slice(0, 5);
  const weekRanking = jornadaNum
    ? ranking
        .map((r) => ({ ...r, puntos: round2(r.porJornada[jornadaNum] ?? 0) }))
        .filter((r) => r.puntos !== 0)
        .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre))
    : [];
  const playerOfWeek = weekRanking[0]?.puntos ? weekRanking[0] : undefined;
  const totals = new Map<string, { team: NonNullable<RankedPlayer["team"]>; pts: number }>();
  for (const r of weekRanking)
    if (r.team) {
      const e = totals.get(r.team.id) ?? { team: r.team, pts: 0 };
      e.pts = round2(e.pts + r.puntos);
      totals.set(r.team.id, e);
    }
  const topTeam = [...totals.values()].sort((x, y) => y.pts - x.pts)[0];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-90"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_35%),radial-gradient(circle_at_80%_60%,white_0,transparent_40%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-primary-foreground md:py-24">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            {t("Denboraldia", "Temporada")} 2026-2027
          </div>
          <h1 className="mt-4 font-display text-5xl leading-none md:text-7xl">
            BZG Fantasy
            <br />
            Eskubaloia
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/90">
            {t(
              "Etxebarriko eskubaloiaren Fantasya. Jarraitu zure jokalariei, begiratu\n            sailkapenak eta gozatu jardunaldi bakoitzaz familia osoarekin.",
              "El Fantasy del balonmano de Etxebarri. Sigue a tus jugadores/as, revisa\n            rankings y disfruta cada jornada con toda la familia.",
            )}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/rankings"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-primary shadow-lg transition hover:-translate-y-0.5"
            >
              <Trophy className="h-4 w-4" /> {t("Ikusi sailkapenak", "Ver rankings")}
            </Link>
            <Link
              to="/equipos"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              <Users className="h-4 w-4" /> {t("Ikusi taldeak", "Ver equipos")}
            </Link>
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              <Shield className="h-4 w-4" /> {t("Administrazioa", "Administración")}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Player of the week */}
          {playerOfWeek && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {t("Jardunaldiko jokalaria", "Jugador/a de la jornada")}
                </span>
                <Trophy className="h-5 w-5 text-gold" style={{ color: "var(--gold)" }} />
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex-1">
                  <div translate="no" className="font-display text-2xl">{playerOfWeek.nombre}</div>
                  <div className="text-sm text-muted-foreground">
                    {playerOfWeek.team?.nombre}
                    {playerOfWeek.team
                      ? ` · ${CAT_LABEL[playerOfWeek.team.categoria as keyof typeof CAT_LABEL]}`
                      : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-4xl text-primary">{playerOfWeek.puntos}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t("puntu guztira", "pts totales")}
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Top team */}
          {topTeam && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-accent">
                  {t("Talde nabarmendua", "Equipo destacado")}
                </span>
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div className="mt-3 font-display text-2xl">{topTeam.team.nombre}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                <CategoryBadge category={topTeam.team.categoria as keyof typeof CAT_LABEL} />
              </div>
              <div className="mt-4 rounded-xl bg-secondary p-4 text-center">
                <div className="font-display text-4xl text-primary">{topTeam.pts}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("Fantasy puntu metatuak", "puntos Fantasy acumulados")}
                </div>
              </div>
              <Link
                to="/equipos/$teamId"
                params={{ teamId: topTeam.team.id }}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {t("Ikusi taldea", "Ver plantilla")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Top 5 & recent matches */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-2xl">{t("Top 5 Fantasy", "Top 5 Fantasy")}</h2>
              <Link to="/rankings" className="text-sm font-medium text-primary hover:underline">
                {t("Ikusi sailkapen osoa", "Ver ranking completo")}
              </Link>
            </div>
            <div className="space-y-2">
              {top5.map((p, i) => (
                <RankedPlayerRow key={p.id} p={p} rank={i + 1} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-2xl">
                {t("Hurrengo partidak", "Próximos partidos")}
              </h2>
              <Link to="/partidos" className="text-sm font-medium text-primary hover:underline">
                {t("Ikusi guztiak", "Ver todos")}
              </Link>
            </div>
            <div className="space-y-2">
              {matches.map((m) => {
                const team = m.club_teams?.nombre ?? "BZG";
                const [y, mo, d] = m.fecha.split("-");
                return (
                  <Link
                    key={m.id}
                    to="/partidos"
                    className="block rounded-xl border border-border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated"
                  >
                    <div className="text-xs text-muted-foreground">
                      {t("J", "J")}
                      {m.jornada} · {`${d}/${mo}/${y}`}
                      {m.hora ? ` · ${m.hora}` : ""}
                    </div>
                    <div className="mt-1 font-semibold">
                      {m.es_local ? `${team} vs ${m.rival}` : `${m.rival} vs ${team}`}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
