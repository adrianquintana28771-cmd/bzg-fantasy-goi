import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import { syncMatchesNow } from "@/lib/match-sync.functions";

export const Route = createFileRoute("/admin/fuentes")({
  head: () => ({
    meta: [
      { title: "Fuentes de partidos · BZG Fantasy" },
      { name: "description", content: "Fuentes de la Federación para sincronizar partidos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <Page />
    </AdminGuard>
  ),
});

type Fuente = {
  id: string;
  nombre: string;
  url: string;
  team_id: string | null;
  equipo_fed: string | null;
  activo: boolean;
  ultima_sync: string | null;
  ultimo_resultado: string | null;
};

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

function Page() {
  const t = useT();
  const { canManageAll } = useAuth();
  const sync = useServerFn(syncMatchesNow);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState({ nombre: "", url: "", team_id: "", equipo_fed: "" });

  const fuentes = useQuery({
    queryKey: ["match_sources"],
    enabled: canManageAll,
    queryFn: async () => {
      const { data, error } = await supabase.from("match_sources").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Fuente[];
    },
  });
  const teams = useQuery({
    queryKey: ["fuentes-teams"],
    enabled: canManageAll,
    queryFn: async () => (await supabase.from("club_teams").select("id,nombre").order("nombre")).data ?? [],
  });

  if (!canManageAll) {
    return <div className="p-10 text-center text-muted-foreground">{t("super_admin bakarrik.", "Sólo super_admin.")}</div>;
  }

  const save = async (f: Fuente) => {
    if (!/^https?:\/\//.test(f.url)) return setMsg(t("URLa ez da zuzena.", "La URL no es válida."));
    const { error } = await supabase
      .from("match_sources")
      .update({ nombre: f.nombre, url: f.url, team_id: f.team_id || null, equipo_fed: f.equipo_fed || null, activo: f.activo })
      .eq("id", f.id);
    setMsg(error ? error.message : t("Gordeta.", "Guardado."));
    fuentes.refetch();
  };
  const add = async () => {
    if (!nuevo.nombre.trim() || !/^https?:\/\//.test(nuevo.url)) return setMsg(t("Izena eta URLa behar dira.", "Faltan nombre y URL válidos."));
    const { error } = await supabase.from("match_sources").insert({
      nombre: nuevo.nombre.trim(),
      url: nuevo.url.trim(),
      team_id: nuevo.team_id || null,
      equipo_fed: nuevo.equipo_fed.trim() || null,
    });
    setMsg(error ? error.message : t("Iturria gehituta.", "Fuente añadida."));
    if (!error) setNuevo({ nombre: "", url: "", team_id: "", equipo_fed: "" });
    fuentes.refetch();
  };
  const syncNow = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await sync();
      setMsg(r.map((x) => `${x.fuente}: ${x.detalle}`).join(" · "));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      fuentes.refetch();
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton />
      <h1 className="mt-3 font-display text-4xl">{t("Partiden iturriak", "Fuentes de partidos")}</h1>
      <p className="text-sm text-muted-foreground">
        {t(
          "Orduro Federazioko egutegia irakurtzen da eta partiden data, ordua eta emaitza eguneratzen dira.",
          "Cada hora se lee el calendario de la Federación y se actualizan fecha, hora y resultado de los partidos.",
        )}
      </p>
      <button
        onClick={syncNow}
        disabled={busy}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? t("Sinkronizatzen…", "Sincronizando…") : t("Orain sinkronizatu", "Sincronizar ahora")}
      </button>
      {msg && <p className="mt-2 text-sm">{msg}</p>}

      <div className="mt-6 space-y-3">
        {(fuentes.data ?? []).map((f) => (
          <FuenteCard key={f.id} f={f} teams={teams.data ?? []} onSave={save} />
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-4">
        <div className="font-display text-lg">{t("Iturri berria", "Nueva fuente")}</div>
        <div className="mt-2 grid gap-2">
          <input className={input} placeholder={t("Izena", "Nombre")} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <input className={input} placeholder="https://www.fvbm.eus/clasificaciones?id=…" value={nuevo.url} onChange={(e) => setNuevo({ ...nuevo, url: e.target.value })} />
          <select className={input} value={nuevo.team_id} onChange={(e) => setNuevo({ ...nuevo, team_id: e.target.value })}>
            <option value="">{t("BZG taldea…", "Equipo BZG…")}</option>
            {(teams.data ?? []).map((tm) => <option key={tm.id} value={tm.id}>{tm.nombre}</option>)}
          </select>
          <input className={input} placeholder={t("Izena Federazioan (adib. BZG NAILUK BERDE)", "Nombre en la Federación (p. ej. BZG NAILUK BERDE)")} value={nuevo.equipo_fed} onChange={(e) => setNuevo({ ...nuevo, equipo_fed: e.target.value })} />
          <button onClick={add} className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-semibold">
            {t("Gehitu", "Añadir")}
          </button>
        </div>
      </div>
    </div>
  );
}

function FuenteCard({ f, teams, onSave }: { f: Fuente; teams: { id: string; nombre: string }[]; onSave: (f: Fuente) => void }) {
  const t = useT();
  const [d, setD] = useState(f);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="grid gap-2">
        <input className={input} value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
        <input className={input} value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} />
        <select className={input} value={d.team_id ?? ""} onChange={(e) => setD({ ...d, team_id: e.target.value })}>
          <option value="">{t("BZG taldea…", "Equipo BZG…")}</option>
          {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.nombre}</option>)}
        </select>
        <input className={input} translate="no" value={d.equipo_fed ?? ""} placeholder={t("Izena Federazioan", "Nombre en la Federación")} onChange={(e) => setD({ ...d, equipo_fed: e.target.value })} />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={d.activo} onChange={(e) => setD({ ...d, activo: e.target.checked })} />
            {t("Aktibo", "Activa")}
          </label>
          <button onClick={() => onSave(d)} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
            {t("Gorde", "Guardar")}
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          {f.ultima_sync ? `${new Date(f.ultima_sync).toLocaleString("es-ES")} · ${f.ultimo_resultado ?? ""}` : t("Oraindik sinkronizatu gabe", "Aún sin sincronizar")}
        </div>
      </div>
    </div>
  );
}
