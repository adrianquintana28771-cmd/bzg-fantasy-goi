import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin/codigos")({
  head: () => ({
    meta: [
      { title: "Códigos de misión · BZG Fantasy" },
      { name: "description", content: "Crear códigos de misión temporales." },
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
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { data: codes = [], refetch } = useQuery({
    queryKey: ["admin-mission-codes"],
    enabled: canManageAll,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_mission_codes");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  if (!canManageAll) {
    return <div className="p-10 text-center text-muted-foreground">{t("super_admin bakarrik.", "Sólo super_admin.")}</div>;
  }

  const create = async () => {
    const c = codigo.trim();
    if (!c) return;
    setBusy(true);
    setMsg(null);
    const { error } = await (
      supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
    )("admin_create_mission_code", { _codigo: c });
    setBusy(false);
    if (error) {
      setMsg(
        error.message.includes("ya está activo")
          ? t("Kode hori aktibo dago jada.", "Ese código ya está activo.")
          : error.message.includes("no válido")
            ? t("Kodea: 3-40 karaktere, letrak, zenbakiak, - edo _.", "Código: 3-40 caracteres, letras, números, - o _.")
            : error.message,
      );
      return;
    }
    setCodigo("");
    setMsg(t("Kodea sortuta (4 orduz aktibo).", "Código creado (activo 4 horas)."));
    refetch();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <BackButton />
      <h1 className="mt-4 font-display text-3xl">{t("Misio-kodeak", "Códigos de misión")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(
          "Kode bakoitza 4 orduz dago aktibo sortzen denetik. Erabiltzaileek Misioak orrian trukatzen dute.",
          "Cada código está activo 4 horas desde su creación. Los usuarios lo canjean en Misiones.",
        )}
      </p>
      <div className="mt-4 flex gap-2">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          maxLength={40}
          placeholder="BZG-..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy || !codigo.trim()}
          onClick={create}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {t("Sortu", "Crear")}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      <h2 className="mt-8 font-display text-xl">{t("Kode aktiboak", "Códigos activos")}</h2>
      {codes.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("Ez dago kode aktiborik.", "No hay códigos activos.")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
          {codes.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span translate="no" className="font-mono font-semibold">{c.codigo_qr}</span>
              <span className="text-muted-foreground">
                {t("Iraungitzea", "Caduca")}: {new Date(c.caduca_at as string).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
