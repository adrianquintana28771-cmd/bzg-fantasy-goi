import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import { adminSetPassword } from "@/lib/admin-password.functions";
import { passwordSchema } from "@/components/auth-panel";

export const Route = createFileRoute("/admin/password")({
  head: () => ({
    meta: [
      { title: "Cambiar contraseña · BZG Fantasy" },
      { name: "description", content: "Cambiar la contraseña de un usuario." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <Page />
    </AdminGuard>
  ),
});

function Page() {
  const t = useT();
  const { canManageAll } = useAuth();
  const setPw = useServerFn(adminSetPassword);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [pw, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users-pw"],
    enabled: canManageAll,
    queryFn: async () =>
      (await supabase.from("profiles").select("id, username, nombre, apellido, display_name").order("username"))
        .data ?? [],
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) =>
      !s || [u.username, u.nombre, u.apellido, u.display_name].some((v) => v?.toLowerCase().includes(s)),
    );
  }, [users, q]);
  const selected = users.find((u) => u.id === sel);

  if (!canManageAll)
    return <div className="p-10 text-center text-muted-foreground">{t("super_admin bakarrik.", "Sólo super_admin.")}</div>;

  const save = async () => {
    setMsg(null);
    if (!sel) return;
    const check = passwordSchema(t).safeParse(pw);
    if (!check.success) return setMsg(check.error.issues[0]?.message ?? t("Pasahitz baliogabea.", "Contraseña no válida."));
    if (pw !== pw2) return setMsg(t("Pasahitzak ez datoz bat.", "Las contraseñas no coinciden."));
    if (!window.confirm(t(`${selected?.username ?? ""} erabiltzailearen pasahitza aldatu?`, `¿Cambiar la contraseña de ${selected?.username ?? ""}?`))) return;
    setBusy(true);
    try {
      await setPw({ data: { userId: sel, password: pw } });
      setMsg(t("Pasahitza aldatuta.", "Contraseña cambiada."));
      setPw1("");
      setPw2("");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <BackButton />
      <h1 className="mt-4 font-display text-3xl">{t("Pasahitza aldatu", "Cambiar contraseña")}</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("Bilatu erabiltzailea...", "Buscar usuario...")}
        className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-border">
        {filtered.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setSel(u.id)}
            className={`block w-full px-3 py-2 text-left text-sm ${sel === u.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
          >
            <span translate="no">{u.username ?? "—"}</span>
            <span className="ml-2 opacity-70" translate="no">
              {[u.nombre, u.apellido].filter(Boolean).join(" ")}
            </span>
          </button>
        ))}
      </div>
      {selected && (
        <div className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-4">
          <div className="text-sm">
            {t("Erabiltzailea", "Usuario")}: <strong translate="no">{selected.username}</strong>
          </div>
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw1(e.target.value)}
            placeholder={t("Pasahitz berria", "Nueva contraseña")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)}
            placeholder={t("Errepikatu pasahitza", "Repite la contraseña")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button type="button" disabled={busy} onClick={save}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {t("Gorde", "Guardar")}
          </button>
        </div>
      )}
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </div>
  );
}
