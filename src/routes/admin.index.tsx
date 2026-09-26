import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar,
  Users,
  ClipboardList,
  Settings,
  FileText,
  Trophy,
  ShieldAlert,
  BarChart3,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Administración · BZG Fantasy" },
      { name: "description", content: "Panel de administración del club." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <Admin />
    </AdminGuard>
  ),
});

function Admin() {
  const t = useT();
  const { data: counts } = useQuery({
    queryKey: ["admin-counts"],
    queryFn: async () => {
      const count = async (
        table: "club_teams" | "club_players" | "club_matches" | "club_match_actions",
      ) => (await supabase.from(table).select("*", { count: "exact", head: true })).count ?? 0;
      const [teams, players, matches, actions, season] = await Promise.all([
        count("club_teams"),
        count("club_players"),
        count("club_matches"),
        count("club_match_actions"),
        supabase.from("club_seasons").select("nombre").eq("is_active", true).maybeSingle(),
      ]);
      return { teams, players, matches, actions, season: season.data?.nombre ?? "—" };
    },
  });
  const {
    isSuperAdmin,
    isManager,
    isAdmin,
    canEditStats,
    canEditMatches,
    canManagePlayers,
    canManageAll,
  } = useAuth();
  const roleLabel = isSuperAdmin ? "super_admin" : isManager ? "manager" : isAdmin ? "admin" : "";
  const roleDescription = isSuperAdmin
    ? t(
        "Dena kudea dezakezu: arauak, partidak, jokalariak eta estatistikak.",
        "Puedes gestionar todo: reglas, partidos, jugadores/as y estadísticas.",
      )
    : isManager
      ? t(
          "Partiden informazioa edita dezakezu eta jokalariak gehitu edo ezabatu.",
          "Puedes editar la información de partidos y añadir o borrar jugadores/as.",
        )
      : t(
          "Jokalari bakoitzaren errendimendua (estatistikak) edita dezakezu partidetan.",
          "Puedes editar el desempeño (estadísticas) de cada jugador/a en los partidos.",
        );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton />
      <div className="mt-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="h-4 w-4" /> {t("Administrazio eremua", "Zona de administración")}
        </div>
        <p className="mt-1 text-xs">
          {t("Uneko rola", "Rol actual")}: <strong>{roleLabel}</strong>. {roleDescription}
        </p>
      </div>

      <h1 className="mt-6 font-display text-4xl">{t("Administrazio panela", "Panel de administración")}</h1>
      <p className="text-sm text-muted-foreground">
        {t(
          "Sartu zure rolak kudeatzen uzten dizun ataletara.",
          "Accede a las secciones que tu rol permite gestionar.",
        )}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Calendar}
          label={t("Denboraldia", "Temporada")}
          value={1}
          sub={`${t("Aktiboa", "Activa")}: ${counts?.season ?? "—"}`}
        />
        <StatCard icon={Users} label={t("Taldeak", "Equipos")} value={counts?.teams ?? 0} />
        <StatCard icon={Users} label={t("Jokalariak", "Jugadores/as")} value={counts?.players ?? 0} />
        <StatCard
          icon={ClipboardList}
          label={t("Partidak", "Partidos")}
          value={counts?.matches ?? 0}
          sub={`${counts?.actions ?? 0} ${t("ekintza erregistratuta", "acciones registradas")}`}
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {canManageAll && (
          <Section
            icon={Settings}
            title={t("Puntuazio-irizpideak", "Criterios de puntuación")}
            description={t(
              "Sortu edo editatu ekintza bakoitzaren puntuak. Gordetzean jardunaldi guztiak berriro kalkulatzen dira. super_admin bakarrik.",
              "Crea o edita los puntos de cada acción. Al guardar se recalculan todas las jornadas. Sólo super_admin.",
            )}
            to="/admin/reglas"
          />
        )}
        {canEditMatches && (
          <Section
            icon={ClipboardList}
            title={t("Partidak kudeatu", "Gestionar partidos")}
            description={t("Sortu eta editatu partidak eta igo akta.", "Crea, edita partidos y sube el acta.")}
            to="/partidos"
          />
        )}
        {canEditStats && (
          <Section
            icon={BarChart3}
            title={t("Jokalarien errendimendua", "Desempeño de jugadores/as")}
            description={t(
              "Formulario ofiziala: idatzi golak, flyak, roskak, geldiketak, lapurretak, hutsak… eta puntuak berez kalkulatzen dira.",
              "Formulario oficial: anota goles, flys, roscas, paradas, robos, fallos… y los puntos se calculan solos.",
            )}
            to="/admin/desempeno"
          />
        )}
        {canManagePlayers && (
          <Section
            icon={Users}
            title={t("Taldeak eta jokalariak", "Equipos y jugadores/as")}
            description={t("Gehitu edo ezabatu talde bakoitzeko jokalariak.", "Añade o borra jugadores/as de cada equipo.")}
            to="/equipos"
          />
        )}
        <Section
          icon={Trophy}
          title={t("Sailkapenak", "Rankings")}
          description={t(
            "Denboraldi, kategoria, jardunaldi eta posizioaren arabera iragazteko sailkapenak.",
            "Rankings filtrables por temporada, categoría, jornada y posición.",
          )}
          to="/rankings"
        />
      </div>

      {canManageAll && <CloseJornada />}

      {canManageAll && (
        <p className="mt-10 text-sm text-muted-foreground">
          {t("Puntuazio-irizpideak hemen kudeatzen dira:", "Los criterios de puntuación se gestionan en")}{" "}
          <Link to="/admin/reglas" className="text-primary underline">
            {t("Puntuazio-irizpideak", "Criterios de puntuación")}
          </Link>
          .{" "}
          {t(
            "Aldatzean, jokatutako jardunaldi guztiak automatikoki berriro kalkulatzen dira.",
            "Al cambiarlos se recalculan automáticamente todas las jornadas ya jugadas.",
          )}
        </p>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Calendar;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 font-display text-4xl text-foreground">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  to,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-lg">{title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function CloseJornada() {
  const t = useT();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: jornada, refetch } = useQuery({
    queryKey: ["admin-jornada-activa"],
    queryFn: async () =>
      (await supabase.from("jornadas").select("id, numero").eq("is_active", true).eq("is_locked", false).order("numero").limit(1).maybeSingle()).data,
  });
  const close = async () => {
    if (!jornada) return;
    if (!window.confirm(t(`${jornada.numero}. jardunaldia behin betiko itxi? Ezin da berriro ireki.`, `¿Cerrar definitivamente la jornada ${jornada.numero}? No se podrá reabrir.`))) return;
    setBusy(true);
    const { error } = await supabase.rpc("close_jornada", { _jornada_id: jornada.id });
    setBusy(false);
    setMsg(error ? error.message : t("Jardunaldia itxita eta alineazioak gordeta.", "Jornada cerrada y alineaciones guardadas."));
    refetch();
    qc.invalidateQueries();
  };
  return (
    <div className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="font-display text-lg">{t("Jardunaldia itxi", "Cerrar jornada")}</div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(
          "Erabiltzaile guztien alineazioaren argazkia gordetzen du. Jardunaldi horrek argazki hori erabiliko du beti puntuatzeko. Ezin da berriro ireki.",
          "Guarda una foto de la alineación de todos los usuarios. Esa jornada puntuará siempre con esa foto. No se puede reabrir.",
        )}
      </p>
      <button
        type="button"
        disabled={!jornada || busy}
        onClick={close}
        className="mt-3 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
      >
        {jornada ? t(`${jornada.numero}. jardunaldia itxi`, `Cerrar jornada ${jornada.numero}`) : t("Jardunaldi irekirik ez", "Sin jornada abierta")}
      </button>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </div>
  );
}
