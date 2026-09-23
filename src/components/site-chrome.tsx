import { Link, useNavigate } from "@tanstack/react-router";
import {
  Home,
  Trophy,
  Users,
  ClipboardList,
  Settings,
  LogIn,
  LogOut,
  Shield,
  Sparkles,
  BarChart3,
  CircleHelp,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import escudoAsset from "@/assets/escudo-bzg.png.asset.json";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AuthPanel } from "@/components/auth-panel";
import { LangToggle, useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { openGuidedTour } from "@/components/guided-tour";

type NavItem = {
  to: string;
  label: [string, string];
  Icon: typeof Home;
  color: string;
  adminOnly?: boolean;
  authOnly?: boolean;
  gameOnly?: boolean;
};

const BASE_NAV: NavItem[] = [
  { to: "/", label: ["Hasiera", "Inicio"], Icon: Home, color: "var(--color-primary)" },
  {
    to: "/plantilla",
    label: ["Taldea", "Equipo"],
    Icon: Shield,
    color: "var(--color-accent)",
    authOnly: true,
    gameOnly: true,
  },
  {
    to: "/misiones",
    label: ["Misioak", "Misiones"],
    Icon: Sparkles,
    color: "var(--gold)",
    authOnly: true,
    gameOnly: true,
  },
  { to: "/rankings", label: ["Sailkapenak", "Rankings"], Icon: Trophy, color: "var(--gold)" },
  { to: "/equipos", label: ["Taldeak", "Equipos"], Icon: Users, color: "var(--color-accent)" },
  {
    to: "/partidos",
    label: ["Partidak", "Partidos"],
    Icon: ClipboardList,
    color: "var(--color-destructive)",
  },
  {
    to: "/admin/desempeno",
    label: ["Errendimendua", "Desempeño"],
    Icon: BarChart3,
    color: "var(--color-primary)",
    adminOnly: true,
  },
  {
    to: "/admin",
    label: ["Admin", "Admin"],
    Icon: Settings,
    color: "var(--color-muted-foreground)",
    adminOnly: true,
  },
];

export function SiteHeader() {
  const { user, displayName, signOut, isStaff, isSuperAdmin, isManager, isAdmin } = useAuth();
  const t = useT();
  const roleLabel = isSuperAdmin
    ? "Super admin"
    : isManager
      ? "Manager"
      : isAdmin
        ? "Admin"
        : t("Erabiltzailea", "Usuario");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="bzg-stripe h-1 w-full" />
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <img
            src={escudoAsset.url}
            alt="Escudo BZG Etxebarri"
            className="h-11 w-11 shrink-0 object-contain drop-shadow"
          />
          <div className="min-w-0 leading-tight">
            <div className="truncate font-display text-lg tracking-wide">BZG Fantasy</div>
            <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
              Eskubaloia · Etxebarri
            </div>
          </div>
        </Link>

        {user ? (
          <div className="flex items-center gap-2">
            <LangToggle />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={openGuidedTour}
              aria-label={t("Laguntza-ibilbidea ireki", "Abrir tutorial guiado")}
              title={t("Laguntza", "Ayuda")}
            >
              <CircleHelp aria-hidden />
            </Button>
            <div className="hidden text-right sm:block">
              <div className="truncate text-sm font-semibold">
                {displayName ?? t("Erabiltzailea", "Usuario")}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {roleLabel}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              aria-label={t("Saioa itxi", "Cerrar sesión")}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("Irten", "Salir")}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={openGuidedTour}
              aria-label={t("Laguntza-ibilbidea ireki", "Abrir tutorial guiado")}
              title={t("Laguntza", "Ayuda")}
            >
              <CircleHelp aria-hidden />
            </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button data-tour="login" className="h-auto rounded-lg px-3 py-2 shadow-card hover:-translate-y-0.5">
                <LogIn className="h-4 w-4" />
                <span>{t("Sartu", "Entrar")}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader className="flex-row items-center justify-between space-y-0 pr-8">
                <SheetTitle className="font-display">BZG Fantasy</SheetTitle>
                <LangToggle />
              </SheetHeader>
              <div className="mt-4">
                <AuthPanel onDone={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          </div>
        )}
      </div>
    </header>
  );
}

export function BottomNav() {
  const { isStaff, user, signOut } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const canPlay = !isStaff;
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
      aria-label={t("Nabigazio nagusia", "Navegación principal")}
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
              data-tour={
                to === "/plantilla"
                  ? "nav-team"
                  : to === "/misiones"
                    ? "nav-missions"
                    : to === "/rankings"
                      ? "nav-rankings"
                      : to === "/equipos"
                        ? "nav-teams"
                        : to === "/partidos"
                          ? "nav-matches"
                          : to === "/admin/desempeno"
                            ? "nav-performance"
                            : to === "/admin"
                              ? "nav-admin"
                              : undefined
              }
              activeOptions={{ exact: to === "/" }}
              className="group flex flex-col items-center justify-center gap-1 px-1 py-2 text-muted-foreground transition data-[status=active]:text-foreground"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-2xl transition ${
                      isActive
                        ? "scale-105 shadow-card"
                        : "bg-secondary/60 group-hover:bg-secondary"
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
                    {t(label[0], label[1])}
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
              aria-label={t("Saioa itxi", "Cerrar sesión")}
              className="group flex w-full flex-col items-center justify-center gap-1 px-1 py-2 text-muted-foreground transition hover:text-foreground"
            >
              <span
                className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary/60 transition group-hover:bg-secondary"
                style={{ color: "var(--color-destructive)" }}
              >
                <LogOut className="h-6 w-6" strokeWidth={2.4} aria-hidden />
              </span>
              <span className="text-[11px] font-semibold leading-none tracking-wide">
                {t("Irten", "Salir")}
              </span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="mt-16 border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-base text-foreground">BZG Fantasy Eskubaloia</div>
            <div>
              {t("Etxebarriko eskubaloiaren Fantasya", "El Fantasy del balonmano de Etxebarri")}
            </div>
          </div>
          <div className="text-xs">
            {t(
              "Klubaren barne-erabilera · Adingabeen pribatutasuna babesten dugu",
              "Uso interno del club · Protegemos la privacidad de menores",
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
