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
import { useFantasy } from "@/lib/fantasy/store";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";

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
  const { seasons, teams, players, matches, stats, actaFiles } = useFantasy((s) => s);
  const {
    isSuperAdmin,
    isManager,
    isAdmin,
    canEditStats,
    canEditMatches,
    canManagePlayers,
    canManageAll,
  } = useAuth();
  const active = seasons.find((s) => s.isActive);
  const roleLabel = isSuperAdmin ? "super_admin" : isManager ? "manager" : isAdmin ? "admin" : "";
  const roleDescription = isSuperAdmin
    ? "Puedes gestionar todo: reglas, partidos, jugadores/as y estadísticas."
    : isManager
      ? "Puedes editar la información de partidos y añadir o borrar jugadores/as."
      : "Puedes editar el desempeño (estadísticas) de cada jugador/a en los partidos.";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton />
      <div className="mt-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="h-4 w-4" /> Zona de administración
        </div>
        <p className="mt-1 text-xs">
          Rol actual: <strong>{roleLabel}</strong>. {roleDescription}
        </p>
      </div>

      <h1 className="mt-6 font-display text-4xl">Panel de administración</h1>
      <p className="text-sm text-muted-foreground">
        Accede a las secciones que tu rol permite gestionar.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Calendar}
          label="Temporadas"
          value={seasons.length}
          sub={`Activa: ${active?.name ?? "—"}`}
        />
        <StatCard icon={Users} label="Equipos" value={teams.length} />
        <StatCard icon={Users} label="Jugadores/as" value={players.length} />
        <StatCard
          icon={ClipboardList}
          label="Partidos"
          value={matches.length}
          sub={`${stats.length} stats · ${Object.keys(actaFiles).length} actas`}
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {canManageAll && (
          <Section
            icon={Settings}
            title="Criterios de puntuación"
            description="Crea o edita los puntos de cada acción. Al guardar se recalculan todas las jornadas. Sólo super_admin."
            to="/admin/reglas"
          />
        )}
        {canEditMatches && (
          <Section
            icon={ClipboardList}
            title="Gestionar partidos"
            description="Crea, edita partidos y sube el acta."
            to="/partidos"
          />
        )}
        {canEditStats && (
          <Section
            icon={BarChart3}
            title="Desempeño de jugadores/as"
            description="Formulario oficial: anota goles, flys, roscas, paradas, robos, fallos… y los puntos se calculan solos."
            to="/admin/desempeno"
          />
        )}
        {canManagePlayers && (
          <Section
            icon={Users}
            title="Equipos y jugadores/as"
            description="Añade o borra jugadores/as de cada equipo."
            to="/equipos"
          />
        )}
        <Section
          icon={Trophy}
          title="Rankings"
          description="Rankings filtrables por temporada, categoría, jornada y posición."
          to="/rankings"
        />
      </div>

      {canManageAll && (
        <p className="mt-10 text-sm text-muted-foreground">
          Los criterios de puntuación se gestionan en{" "}
          <Link to="/admin/reglas" className="text-primary underline">
            Criterios de puntuación
          </Link>
          . Al cambiarlos se recalculan automáticamente todas las jornadas ya jugadas.
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
