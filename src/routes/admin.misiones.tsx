import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin/misiones")({
  head: () => ({
    meta: [
      { title: "Gestión de misiones · BZG Fantasy" },
      { name: "description", content: "Crear y gestionar misiones del club." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <Page />
    </AdminGuard>
  ),
});

interface Row {
  id: string;
  nombre: string;
  descripcion: string;
  enlace: string | null;
  recompensa_sobres: number;
  semanal: boolean;
  is_active: boolean;
}

const empty = { id: null as string | null, nombre: "", descripcion: "", enlace: "", recompensa: 1, semanal: false, activa: true };

function Page() {
  const t = useT();
  const { canManageAll } = useAuth();
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { data: rows = [], refetch } = useQuery({
    queryKey: ["admin-misiones"],
    enabled: canManageAll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("misiones")
        .select("id, nombre, descripcion, enlace, recompensa_sobres, semanal, is_active")
        .eq("creada_admin", true)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  if (!canManageAll) {
    return <div className="p-10 text-center text-muted-foreground">{t("super_admin bakarrik.", "Sólo super_admin.")}</div>;
  }

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("admin_save_mision", {
      _id: f.id as string,
      _nombre: f.nombre,
      _descripcion: f.descripcion,
      _enlace: f.enlace,
      _recompensa: f.recompensa,
      _semanal: f.semanal,
      _activa: f.activa,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setF(empty);
    setMsg(t("Misioa gordeta.", "Misión guardada."));
    refetch();
  };

  const remove = async (r: Row) => {
    if (!window.confirm(t(`"${r.nombre}" misioa ezabatu?`, `¿Eliminar la misión "${r.nombre}"?`))) return;
    const { error } = await supabase.rpc("admin_delete_mision", { _id: r.id });
    setMsg(error ? error.message : t("Misioa ezabatuta.", "Misión eliminada."));
    if (f.id === r.id) setF(empty);
    refetch();
  };

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <BackButton />
      <h1 className="mt-4 font-display text-3xl">{t("Misioen kudeaketa", "Gestión de misiones")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(
          "Hemen sortutako misioak Misioak orrian agertzen dira, besteekin batera.",
          "Las misiones creadas aquí aparecen en Misiones junto a las demás.",
        )}
      </p>

      <div className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="font-display text-lg">
          {f.id ? t("Misioa editatu", "Editar misión") : t("Misio berria", "Nueva misión")}
        </div>
        <input className={input} maxLength={120} placeholder={t("Izenburua", "Título")} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        <textarea className={input} maxLength={500} rows={2} placeholder={t("Deskribapena (aukerakoa)", "Descripción (opcional)")} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        <input className={input} maxLength={500} placeholder={t("Esteka (aukerakoa) https://...", "Enlace (opcional) https://...")} value={f.enlace} onChange={(e) => setF({ ...f, enlace: e.target.value })} />
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            {t("Gutunazalak", "Sobres")}
            <input type="number" min={1} max={10} className="w-16 rounded-lg border border-border bg-background px-2 py-1" value={f.recompensa} onChange={(e) => setF({ ...f, recompensa: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.semanal} onChange={(e) => setF({ ...f, semanal: e.target.checked })} /> {t("Astekoa", "Semanal")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.activa} onChange={(e) => setF({ ...f, activa: e.target.checked })} /> {t("Aktiboa", "Activa")}
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={busy || f.nombre.trim().length < 2} onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {t("Gorde", "Guardar")}
          </button>
          {f.id && (
            <button type="button" onClick={() => setF(empty)} className="rounded-lg border border-border px-4 py-2 text-sm">
              {t("Utzi", "Cancelar")}
            </button>
          )}
        </div>
        {msg && <p className="text-sm">{msg}</p>}
      </div>

      <h2 className="mt-8 font-display text-xl">{t("Sortutako misioak", "Misiones creadas")}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("Ez dago misiorik.", "No hay misiones.")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-semibold">
                  {r.nombre} {!r.is_active && <span className="text-xs text-muted-foreground">({t("ez aktiboa", "inactiva")})</span>}
                </div>
                {r.enlace && <div className="truncate text-xs text-muted-foreground">{r.enlace}</div>}
                <div className="text-xs text-muted-foreground">+{r.recompensa_sobres} · {r.semanal ? t("Astekoa", "Semanal") : t("Behin", "Única")}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" className="text-primary underline" onClick={() => setF({ id: r.id, nombre: r.nombre, descripcion: r.descripcion, enlace: r.enlace ?? "", recompensa: r.recompensa_sobres, semanal: r.semanal, activa: r.is_active })}>
                  {t("Editatu", "Editar")}
                </button>
                <button type="button" className="text-destructive underline" onClick={() => remove(r)}>
                  {t("Ezabatu", "Eliminar")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
