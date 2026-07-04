import { Link } from "@tanstack/react-router";
import { Home, Trophy, Users, ClipboardList, Settings } from "lucide-react";

const NAV = [
  { to: "/", label: "Inicio", Icon: Home, color: "var(--color-primary)" },
  { to: "/rankings", label: "Rankings", Icon: Trophy, color: "var(--gold)" },
  { to: "/equipos", label: "Equipos", Icon: Users, color: "var(--color-accent)" },
  { to: "/partidos", label: "Partidos", Icon: ClipboardList, color: "var(--color-destructive)" },
  { to: "/admin", label: "Admin", Icon: Settings, color: "var(--color-muted-foreground)" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="bzg-stripe h-1 w-full" />
      <div className="mx-auto flex max-w-6xl items-center justify-center px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground font-display text-lg shadow-card">
            BZG
          </span>
          <div className="leading-tight">
            <div className="font-display text-lg tracking-wide">BZG Fantasy</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Eskubaloia · Etxebarri
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}

export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {NAV.map(({ to, label, Icon, color }) => (
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
                    style={
                      isActive
                        ? { background: color, color: "white" }
                        : { color }
                    }
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
