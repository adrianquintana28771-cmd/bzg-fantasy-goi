import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, KeyRound } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Restablecer contraseña · BZG Fantasy" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

const makeSchema = (t: (eu: string, es: string) => string) =>
  z
    .object({
      password: z.string().min(6, t("Gutxienez 6 karaktere", "Mínimo 6 caracteres")).max(72),
      confirm: z.string().min(6, t("Gutxienez 6 karaktere", "Mínimo 6 caracteres")).max(72),
    })
    .refine((v) => v.password === v.confirm, {
      message: t("Pasahitzak ez datoz bat", "Las contraseñas no coinciden"),
      path: ["confirm"],
    });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const t = useT();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase JS parses the recovery token from the URL hash on load
    // and fires PASSWORD_RECOVERY, giving us a temporary session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
      }
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = makeSchema(t).safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("Pasahitza eguneratuta. Orain sar zaitezke!", "Contraseña actualizada. ¡Ya puedes entrar!"));
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Link
        to="/auth"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("Sartu", "Entrar")}
      </Link>
      <div
        className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-card"
        style={{ background: "var(--gradient-card)" }}
      >
        <h1 className="font-display text-3xl">{t("Pasahitz berria", "Nueva contraseña")}</h1>

        {!ready ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("Kargatzen...", "Cargando...")}</p>
        ) : !hasSession ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-muted-foreground">
              {t(
                "Esteka ez da baliozkoa edo iraungita dago. Eskatu berri bat sarbide-pantailatik.",
                "El enlace no es válido o ha caducado. Solicita uno nuevo desde la pantalla de acceso.",
              )}
            </p>
            <Link
              to="/auth"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-display text-lg text-primary-foreground shadow-card"
            >
              {t("Berriro sartu", "Volver a entrar")}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("Pasahitz berria", "Nueva contraseña")}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                maxLength={72}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("Errepikatu pasahitza", "Repite la contraseña")}
              </span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                maxLength={72}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-display text-lg text-primary-foreground shadow-card transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              <KeyRound className="h-5 w-5" /> {busy ? t("Gordetzen...", "Guardando...") : t("Pasahitza gorde", "Guardar contraseña")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
