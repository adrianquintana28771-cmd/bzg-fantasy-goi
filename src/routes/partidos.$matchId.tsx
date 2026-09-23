import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Download, Upload, FileText } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useFantasy, fantasyStore } from "@/lib/fantasy/store";
import { pointsForStat } from "@/lib/fantasy/queries";
import { CategoryBadge, StatusBadge } from "@/components/fantasy-ui";
import { generateActaPDF } from "@/lib/fantasy/pdf";
import { POSITION_LABEL, POSITION_LABEL_EU } from "@/lib/fantasy/types";
import { useT, useLang } from "@/lib/i18n";

export const Route = createFileRoute("/partidos/$matchId")({
  head: ({ params }) => {
    const title = "Partido de balonmano | BZG Fantasy Eskubaloia";
    const description =
      "Resultado, acta y estadísticas por jugador/a de este partido de balonmano del club BZG Etxebarri.";
    const url = `https://bzg-fantasy-goi.lovable.app/partidos/${params.matchId}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: PartidoDetalle,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-10 text-center">
      <h1 className="font-display text-3xl">Partida ez da aurkitu / Partido no encontrado</h1>
      <Link to="/partidos" className="mt-4 inline-block text-primary hover:underline">Atzera / Volver</Link>
    </div>
  ),
});

function PartidoDetalle() {
  const t = useT();
  const { lang } = useLang();
  const POS_LABEL = lang === "eu" ? POSITION_LABEL_EU : POSITION_LABEL;
  const { matchId } = Route.useParams();
  const { matches, teams, players, stats, rules, actaFiles } = useFantasy((s) => s);
  const match = matches.find((m) => m.id === matchId);
  if (!match) throw notFound();
  const team = teams.find((t) => t.id === match.teamId)!;
  const roster = players.filter((p) => p.teamId === team.id);
  const matchStats = stats.filter((s) => s.matchId === match.id);
  const acta = actaFiles[match.id];
  const fileRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const blob = await generateActaPDF(match!, team, roster);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `acta-${match!.matchCode}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("Akta deskargatu da", "Acta descargada"));
    } catch (e) {
      toast.error(t("Errorea akta sortzean", "Error generando el acta"));
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("Fitxategia handiegia da (max 5MB)", "Archivo demasiado grande (máx 5MB)"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      fantasyStore.saveActa(match!.id, reader.result as string);
      toast.success(t("Akta ondo igo da", "Acta subida correctamente"));
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/partidos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("Partidak", "Partidos")}
      </Link>

      <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-card" style={{ background: "var(--gradient-card)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground">
              {t("Jardunaldia", "Jornada")} {match.round} · {new Date(match.date).toLocaleDateString("es-ES")} · {match.locationType === "local" ? t("Etxean", "Local") : t("Kanpoan", "Visitante")}
            </div>
            <h1 className="mt-1 font-display text-3xl md:text-4xl">
              {match.locationType === "local"
                ? `${team.name} vs ${match.opponent}`
                : `${match.opponent} vs ${team.name}`}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CategoryBadge category={team.category} />
              <StatusBadge status={match.status} />
              <span className="text-xs text-muted-foreground">{t("Kodea", "Código")}: {match.matchCode}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-5xl text-primary">
              {match.locationType === "local"
                ? `${match.goalsFor}-${match.goalsAgainst}`
                : `${match.goalsAgainst}-${match.goalsFor}`}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {downloading ? t("Sortzen...", "Generando...") : t("Deskargatu akta PDFa", "Descargar acta PDF")}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-card transition hover:-translate-y-0.5"
          >
            <Upload className="h-4 w-4" /> {t("Igo akta", "Subir acta")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleUpload}
          />
          {acta && (
            <a
              href={acta}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              <FileText className="h-4 w-4" /> {t("Ikusi igotako akta", "Ver acta subida")}
            </a>
          )}
        </div>
      </div>

      <h2 className="mt-8 font-display text-2xl">{t("Jokalari bakoitzaren estatistikak", "Estadísticas por jugador/a")}</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">{t("Jokalaria", "Jugador/a")}</th>
              <th className="px-2 py-2 text-center">G</th>
              <th className="px-2 py-2 text-center">A</th>
              <th className="px-2 py-2 text-center">{t("Ber", "Rec")}</th>
              <th className="px-2 py-2 text-center">{t("Blk", "Blq")}</th>
              <th className="px-2 py-2 text-center">{t("Gld", "Prd")}</th>
              <th className="px-2 py-2 text-center">{t("Gel", "Par")}</th>
              <th className="px-2 py-2 text-center">MVP</th>
              <th className="px-3 py-2 text-right">{t("Ptak", "Pts")}</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((p) => {
              const st = matchStats.find((s) => s.playerId === p.id);
              if (!st) return null;
              const pts = pointsForStat(st, match, team, rules);
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-display text-base">{p.dorsal}</td>
                  <td className="px-3 py-2">
                    <Link
                      to="/jugadores/$playerId"
                      params={{ playerId: p.id }}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {p.publicName}
                    </Link>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {POS_LABEL[p.position]}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">{st.goals}</td>
                  <td className="px-2 py-2 text-center">{st.assists}</td>
                  <td className="px-2 py-2 text-center">{st.steals}</td>
                  <td className="px-2 py-2 text-center">{st.blocks}</td>
                  <td className="px-2 py-2 text-center">{st.turnovers}</td>
                  <td className="px-2 py-2 text-center">{st.saves}</td>
                  <td className="px-2 py-2 text-center">{st.mvp ? "⭐" : ""}</td>
                  <td className="px-3 py-2 text-right font-display text-lg text-primary">{pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
