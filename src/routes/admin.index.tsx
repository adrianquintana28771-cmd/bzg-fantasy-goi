import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Users, ClipboardList, Settings, FileText, Trophy, ShieldAlert } from "lucide-react";
import { useFantasy, fantasyStore } from "@/lib/fantasy/store";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";

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
  const { seasons, teams, players, matches, stats, rules, actaFiles } = useFantasy((s) => s);
  const active = seasons.find((s) => s.isActive);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton />
      <div className="mt-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="h-4 w-4" /> Zona de administración
        </div>
        <p className="mt-1 text-xs">
          Estás dentro porque tienes rol <strong>admin</strong>. Para dar el rol a otra
          persona, añade una fila en la tabla <code>user_roles</code> con su <code>user_id</code> y rol <code>admin</code>.
        </p>
      </div>

      <h1 className="mt-6 font-display text-4xl">Panel de administración</h1>
      <p className="text-sm text-muted-foreground">Gestiona temporadas, equipos, jugadores/as, partidos y puntuación.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Calendar} label="Temporadas" value={seasons.length} sub={`Activa: ${active?.name ?? "—"}`} />
        <StatCard icon={Users} label="Equipos" value={teams.length} />
        <StatCard icon={Users} label="Jugadores/as" value={players.length} />
        <StatCard icon={ClipboardList} label="Partidos" value={matches.length} sub={`${stats.length} stats · ${Object.keys(actaFiles).length} actas`} />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Section
          icon={Settings}
          title="Reglas de puntuación"
          description="Configura los puntos Fantasy de cada acción. Con opción de modo educativo."
          to="/admin/reglas"
        />
        <Section
          icon={ClipboardList}
          title="Gestionar partidos"
          description="Crea partidos, genera actas y sube el acta con las estadísticas."
          to="/partidos"
        />
        <Section
          icon={Users}
          title="Equipos y plantillas"
          description="Consulta equipos, jugadores/as y sus estadísticas."
          to="/equipos"
        />
        <Section
          icon={Trophy}
          title="Rankings"
          description="Rankings filtrables por temporada, categoría, jornada y posición."
          to="/rankings"
        />
      </div>

      <h2 className="mt-10 font-display text-2xl">Reglas activas actualmente</h2>
      <p className="text-xs text-muted-foreground">Vista rápida — edítalas en “Reglas de puntuación”.</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {rules.filter((r) => r.active).map((r) => (
          <div
            key={r.key}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <span>{r.label}</span>
            <span
              className={`font-display text-lg ${r.points >= 0 ? "text-primary" : "text-destructive"}`}
            >
              {r.points > 0 ? `+${r.points}` : r.points}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          onClick={() => {
            fantasyStore.resetRules();
            toast.success("Reglas restauradas");
          }}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-secondary"
        >
          Restaurar reglas por defecto
        </button>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, sub,
}: {
  icon: typeof Calendar;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 font-display text-4xl text-foreground">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Section({
  icon: Icon, title, description, to,
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
