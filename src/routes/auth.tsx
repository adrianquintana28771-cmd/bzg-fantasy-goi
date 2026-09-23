import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AuthPanel } from "@/components/auth-panel";
import { LangToggle, useT } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sartu · BZG Fantasy" },
      { name: "description", content: "Sartu edo erregistratu BZG Fantasy Eskubaloian." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t("Hasiera", "Inicio")}
        </Link>
        <LangToggle />
      </div>
      <div
        className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-card"
        style={{ background: "var(--gradient-card)" }}
      >
        <AuthPanel />
      </div>
    </div>
  );
}
