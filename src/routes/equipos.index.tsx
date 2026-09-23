import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CategoryBadge } from "@/components/fantasy-ui";
import { BackButton } from "@/components/back-button";
import { CATEGORY_LABEL, CATEGORY_LABEL_EU, type Category } from "@/lib/fantasy/types";
import { useT, useLang } from "@/lib/i18n";
import { fetchPool, fetchPointsByPlayer, fetchTeams, round2 } from "@/lib/club-data";
import { Users } from "lucide-react";

export const Route = createFileRoute("/equipos/")({
  head: () => {
    const title = "Equipos de balonmano | BZG Fantasy Eskubaloia";
    const description =
      "Equipos de balonmano del club BZG Etxebarri por categoría (cadete, juvenil y senior, masculino y femenino) con sus plantillas y puntos fantasy.";
    const url = "https://bzg-fantasy-goi.lovable.app/equipos";
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
  component: Equipos,
});

const ORDER: Category[] = ["senior", "juvenil", "cadete"] as Category[];

function Equipos() {
  const t = useT();
  const { lang } = useLang();
  const CAT_LABEL = lang === "eu" ? CATEGORY_LABEL_EU : CATEGORY_LABEL;
  const q = useQuery({
    queryKey: ["club-equipos"],
    queryFn: async () => {
      const [teams, pool, pts] = await Promise.all([fetchTeams(), fetchPool(), fetchPointsByPlayer()]);
      return { teams, pool, pts };
    },
  });
  const teams = q.data?.teams ?? [];
  const pool = q.data?.pool ?? [];
  const pts = q.data?.pts ?? {};

  const grouped = ORDER.map((cat) => ({
    category: cat,
    teams: teams.filter((t) => t.categoria === cat).sort((a, b) => a.sexo.localeCompare(b.sexo)),
  })).filter((g) => g.teams.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton />
      <h1 className="mt-3 font-display text-4xl">{t("Taldeak", "Equipos")}</h1>
      <p className="text-sm text-muted-foreground">{t("BZG Etxebarriko eskubaloi taldeak", "Equipos de balonmano del BZG Etxebarri")}</p>
      {q.isLoading && <p className="mt-6 text-sm text-muted-foreground">{t("Kargatzen…", "Cargando…")}</p>}

      <div className="mt-8 space-y-10">
        {grouped.map(({ category, teams: cts }) => (
          <div key={category}>
            <h2 className="mb-3 font-display text-2xl">{CAT_LABEL[category]}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cts.map((t) => {
                const roster = pool.filter((p) => p.team_id === t.id && !p.club?.es_entrenador);
                const teamPts = round2(roster.reduce((a, p) => a + (pts[p.id] ?? 0), 0));
                return (
                  <Link
                    key={t.id}
                    to="/equipos/$teamId"
                    params={{ teamId: t.id }}
                    className="group rounded-2xl border border-border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated"
                    style={{ background: "var(--gradient-card)" }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-display text-xl">{t.nombre}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <CategoryBadge category={t.categoria as Category} />
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium capitalize text-secondary-foreground">
                            {t.sexo}
                          </span>
                        </div>
                      </div>
                      <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Users className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div className="text-sm text-muted-foreground">{roster.length} {t("jokalari", "jugadores/as")}</div>
                      <div className="text-right">
                        <div className="font-display text-2xl text-primary">{teamPts}</div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("taldearen ptak", "pts equipo")}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
