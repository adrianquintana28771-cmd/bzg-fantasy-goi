import { Link, useNavigate } from "@tanstack/react-router";
import { Home, Trophy, Users, ClipboardList, Settings, LogIn, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type NavItem = {
  to: string;
  label: string;
  Icon: typeof Home;
  color: string;
  adminOnly?: boolean;
  authOnly?: boolean;
  gameOnly?: boolean;
};

const BASE_NAV: NavItem[] = [
  { to: "/", label: "Inicio", Icon: Home, color: "var(--color-primary)" },
  { to: "/plantilla", label: "Plantilla", Icon: Shield, color: "var(--color-accent)", authOnly: true, gameOnly: true },
  { to: "/rankings", label: "Rankings", Icon: Trophy, color: "var(--gold)" },
  { to: "/equipos", label: "Equipos", Icon: Users, color: "var(--color-accent)" },
  { to: "/partidos", label: "Partidos", Icon: ClipboardList, color: "var(--color-destructive)" },
  { to: "/admin", label: "Admin", Icon: Settings, color: "var(--color-muted-foreground)", adminOnly: true },
];

export function SiteHeader() {
  const { user, displayName, signOut, isStaff, isSuperAdmin, isManager, isAdmin } = useAuth();
  const roleLabel = isSuperAdmin ? "Super admin" : isManager ? "Manager" : isAdmin ? "Admin" : "Usuario";
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="bzg-stripe h-1 w-full" />
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground font-display text-lg shadow-card">
            BZG
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate font-display text-lg tracking-wide">BZG Fantasy</div>
            <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
              Eskubaloia · Etxebarri
            </div>
          </div>
        </Link>

        {user ? (
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="truncate text-sm font-semibold">{displayName ?? "Usuario"}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {roleLabel}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Cerrar sesión"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        ) : (
          <Link
            to="/auth"
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card hover:-translate-y-0.5"
          >
            <LogIn className="h-4 w-4" />
            <span>Entrar</span>
          </Link>
        )}
      </div>
    </header>
  );
}

export function BottomNav() {
  const { isStaff, user, signOut, isSuperAdmin, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const canPlay = isSuperAdmin || (!isAdmin && !isManager);
  const nav = BASE_NAV.filter(
    (n) => (!n.adminOnly || isStaff) && (!n.authOnly || !!user) && (!n.gameOnly || canPlay),
  );
  const cols = nav.length + (user ? 1 : 0);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul
        className="mx-auto grid max-w-2xl"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {nav.map(({ to, label, Icon, color }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="group flex flex-col items-center justify-center gap-1 px-1 py-2 text-muted-foreground transition data-[status=active]:text-foreground"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-2xl transition ${
                      isActive ? "scale-105 shadow-card" : "bg-secondary/60 group-hover:bg-secondary"
                    }`}
                    style={isActive ? { background: color, color: "white" } : { color }}
                  >
                    <Icon className="h-6 w-6" strokeWidth={2.4} aria-hidden />
                  </span>
                  <span
                    className={`text-[11px] font-semibold leading-none tracking-wide ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </>
              )}
            </Link>
          </li>
        ))}
        {user && (
          <li>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Cerrar sesión"
              className="group flex w-full flex-col items-center justify-center gap-1 px-1 py-2 text-muted-foreground transition hover:text-foreground"
            >
              <span
                className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary/60 transition group-hover:bg-secondary"
                style={{ color: "var(--color-destructive)" }}
              >
                <LogOut className="h-6 w-6" strokeWidth={2.4} aria-hidden />
              </span>
              <span className="text-[11px] font-semibold leading-none tracking-wide">Salir</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-base text-foreground">BZG Fantasy Eskubaloia</div>
            <div>El Fantasy del balonmano de Etxebarri</div>
          </div>
          <div className="text-xs">
            Uso interno del club · Protegemos la privacidad de menores · v0.1 MVP
          </div>
        </div>
      </div>
    </footer>
  );
}
