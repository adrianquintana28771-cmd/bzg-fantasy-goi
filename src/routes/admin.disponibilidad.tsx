import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import { fetchAllRows } from "@/lib/club-data";
import type { PlayerEstado } from "@/lib/fantasy/types";

export const Route = createFileRoute("/admin/disponibilidad")({
  head: () => ({
    meta: [
      { title: "Disponibilidad de jugadores · BZG Fantasy" },
      { name: "description", content: "Gestiona jugadores/as no disponibles y dudosos." },
      { property: "og:title", content: "Disponibilidad de jugadores · BZG Fantasy" },
      { property: "og:description", content: "Gestión centralizada de la disponibilidad." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <Page />
    </AdminGuard>
  ),
});

type Row = {
  id: string;
  nombre: string;
  apellido1: string | null;
  apellido2: string | null;
  estado: PlayerEstado;
  es_entrenador: boolean;
  club_player_teams: { club_teams: { nombre: string } | null }[];
};

function Page() {
  const t = useT();
  const qc = useQueryClient();
  const { isSuperAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { data: players = [], isPending } = useQuery({
    queryKey: ["admin-disponibilidad"],
    enabled: isSuperAdmin,
    queryFn: () =>
      fetchAllRows((from, to) =>
        supabase
          .from("club_players")
          .select("id, nombre, apellido1, apellido2, estado, es_entrenador, club_player_teams(club_teams(nombre))")
          .eq("activo", true)
          .order("nombre")
          .range(from, to),
      ) as Promise<Row[]>,
  });

  if (!isSuperAdmin)
    return <p className="p-10 text-center text-muted-foreground">{t("Super admin bakarrik.", "Sólo super admin.")}</p>;

  const full = (p: Row) => [p.nombre, p.apellido1, p.apellido2].filter(Boolean).join(" ");
  const teams = (p: Row) => p.club_player_teams.map((x) => x.club_teams?.nombre).filter(Boolean).join(", ");

  const save = async (id: string, estado: PlayerEstado) => {
    setBusy(id);
    setErr(null);
    const { error } = await supabase.rpc("set_player_estado", { _club_player_id: id, _estado: estado });
    setBusy(null);
    if (error) return setErr(error.message);
    await qc.invalidateQueries();
  };

  const marked = players.filter((p) => p.estado !== "disponible");
  const term = q.trim().toLowerCase();
  const results = term.length < 2 ? [] : players.filter((p) => p.estado === "disponible" && `${full(p)} ${teams(p)}`.toLowerCase().includes(term)).slice(0, 20);

  const Btn = ({ p, v, label, cls }: { p: Row; v: PlayerEstado; label: string; cls: string }) => (
    <button type="button" disabled={busy === p.id || p.estado === v} onClick={() => save(p.id, v)}
      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${p.estado === v ? cls : "border-border bg-card hover:bg-muted"}`}>
      {label}
    </button>
  );
  const Item = ({ p }: { p: Row }) => (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3">
      <div>
        <div translate="no" className="font-semibold">{full(p)}</div>
        <div translate="no" className="text-xs text-muted-foreground">{teams(p)}{p.es_entrenador ? ` · ${t("Entrenatzailea", "Entrenador/a")}` : ""}</div>
      </div>
      <div className="flex gap-2">
        <Btn p={p} v="disponible" label={t("Eskuragarri", "Disponible")} cls="border-primary bg-primary text-primary-foreground" />
        <Btn p={p} v="dudoso" label={t("Zalantzazkoa", "Dudoso")} cls="border-warning bg-warning text-warning-foreground" />
        <Btn p={p} v="no_disponible" label={t("Ez eskuragarri", "No disponible")} cls="border-destructive bg-destructive text-destructive-foreground" />
      </div>
    </li>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <BackButton />
      <h1 className="mt-6 font-display text-4xl">{t("Jokalarien eskuragarritasuna", "Disponibilidad de jugadores/as")}</h1>
      {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-xl">{t("Ez eskuragarri eta zalantzazkoak", "No disponibles y dudosos")} ({marked.length})</h2>
        {isPending ? <p className="mt-3 text-sm text-muted-foreground">{t("Kargatzen…", "Cargando…")}</p>
          : marked.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("Denak eskuragarri.", "Todos disponibles.")}</p>
          : <ul className="mt-2">{marked.map((p) => <Item key={p.id} p={p} />)}</ul>}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-xl">{t("Jokalaria gehitu", "Añadir jugador/a")}</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Bilatu izena edo taldea…", "Buscar nombre o equipo…")}
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <ul className="mt-2">{results.map((p) => <Item key={p.id} p={p} />)}</ul>
      </section>
    </div>
  );
}
