import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin/jugadores")({
  head: () => ({
    meta: [
      { title: "Añadir o eliminar jugadores · BZG Fantasy" },
      { name: "description", content: "Elimina o vuelve a añadir jugadores/as del club conservando su historial." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminJugadores />
    </AdminGuard>
  ),
});

function AdminJugadores() {
  const t = useT();
  const { canManageAll } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-jugadores"],
    queryFn: async () => {
      const [pl, tm, lk] = await Promise.all([
        supabase.from("club_players").select("id,nombre,apellido1,es_entrenador,activo").order("nombre"),
        supabase.from("club_teams").select("id,nombre,club_seasons!inner(is_active)").eq("club_seasons.is_active", true),
        supabase.from("club_player_teams").select("player_id,team_id"),
      ]);
      for (const r of [pl, tm, lk]) if (r.error) throw r.error;
      const tn = new Map((tm.data ?? []).map((x) => [x.id, x.nombre]));
      const byP = new Map<string, string[]>();
      for (const l of lk.data ?? []) {
        const n = tn.get(l.team_id);
        if (n) byP.set(l.player_id, [...(byP.get(l.player_id) ?? []), n]);
      }
      return (pl.data ?? []).map((p) => ({ ...p, teams: byP.get(p.id) ?? [] }));
    },
  });

  const list = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const all = q.data ?? [];
    return f
      ? all.filter(
          (p) =>
            p.nombre.toLowerCase().includes(f) ||
            (p.apellido1 ?? "").toLowerCase().includes(f) ||
            p.teams.some((x) => x.toLowerCase().includes(f)),
        )
      : all;
  }, [q.data, filter]);

  const setActivo = async (id: string, activo: boolean) => {
    setBusy(id);
    setMsg(null);
    const { error } = await supabase.rpc("set_player_activo", { _player_id: id, _activo: activo });
    setBusy(null);
    if (error) return setMsg(error.message);
    setMsg(activo ? t("Jokalaria berriro gehituta.", "Jugador/a añadido/a de nuevo.") : t("Jokalaria kenduta.", "Jugador/a eliminado/a."));
    qc.invalidateQueries();
  };

  if (!canManageAll)
    return <div className="mx-auto max-w-md p-10 text-center text-sm text-muted-foreground">{t("super_admin bakarrik.", "Sólo super_admin.")}</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <BackButton />
      <h1 className="mt-3 font-display text-4xl">{t("Jokalariak gehitu / kendu", "Añadir / eliminar jugadores/as")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(
          "Kendutako jokalariak ez dira agertuko sobreetan, lerrokatzeetan, Errendimenduan, Taldeetan edo sailkapenean. Itxitako jardunaldiak eta puntuak gordetzen dira.",
          "Los jugadores/as eliminados no aparecen en sobres, alineaciones, Desempeño, Equipos ni Clasificación. Las jornadas cerradas y sus puntos se conservan.",
        )}
      </p>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t("Bilatu jokalaria edo taldea…", "Buscar jugador/a o equipo…")}
        className="mt-6 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
      />
      {msg && <p className="mt-3 text-sm text-primary">{msg}</p>}
      <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card shadow-card">
        {q.isLoading && <p className="p-4 text-center text-sm text-muted-foreground">{t("Kargatzen…", "Cargando…")}</p>}
        {list.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
            <div className={p.activo ? "" : "opacity-60"}>
              <span translate="no" className={`font-semibold ${p.activo ? "" : "line-through"}`}>
                {p.nombre}
                {p.apellido1 ? ` ${p.apellido1}` : ""}
              </span>
              <span className="block text-xs text-muted-foreground">
                {p.teams.join(" · ") || t("Talderik gabe", "Sin equipo")}
                {p.es_entrenador ? ` · ${t("Entrenatzailea", "Entrenador/a")}` : ""}
              </span>
            </div>
            <button
              type="button"
              disabled={busy === p.id}
              onClick={() => {
                if (p.activo && !confirm(t("Jokalaria kendu?", "¿Eliminar a este jugador/a?"))) return;
                setActivo(p.id, !p.activo);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                p.activo ? "bg-destructive/10 text-destructive" : "bg-primary text-primary-foreground"
              }`}
            >
              {p.activo ? t("Kendu", "Eliminar") : t("Gehitu", "Añadir")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
