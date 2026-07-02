import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Inicio" },
  { to: "/rankings", label: "Rankings" },
  { to: "/equipos", label: "Equipos" },
  { to: "/partidos", label: "Partidos" },
  { to: "/admin", label: "Admin" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="bzg-stripe h-1 w-full" />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-display text-lg shadow-card">
            BZG
          </span>
          <div className="leading-tight">
            <div className="font-display text-lg tracking-wide">BZG Fantasy</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Eskubaloia · Etxebarri</div>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-secondary-foreground"
              activeProps={{ className: "bg-secondary text-secondary-foreground" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <button
          className="rounded-md border border-border p-2 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <div className={cn("md:hidden", open ? "block" : "hidden")}>
        <nav className="flex flex-col gap-1 border-t border-border bg-background px-4 py-3">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
              activeProps={{ className: "bg-secondary text-secondary-foreground" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
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
