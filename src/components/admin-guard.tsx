import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { loading, user, isStaff } = useAuth();
  const navigate = useNavigate();
  const t = useT();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="mx-auto max-w-md p-10 text-center text-muted-foreground">{t("Kargatzen...", "Cargando...")}</div>
    );
  }
  if (!user) return null;
  if (!isStaff) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-warning" />
        <h1 className="mt-3 font-display text-3xl">{t("Eremu mugatua", "Zona restringida")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "Administratzaileek bakarrik sar daitezke atal honetara.",
            "Sólo las personas administradoras pueden acceder a esta sección.",
          )}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t("Hasierara itzuli", "Volver al inicio")}
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
