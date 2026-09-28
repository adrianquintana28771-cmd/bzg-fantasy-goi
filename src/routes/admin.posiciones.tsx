import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useT, useLang } from "@/lib/i18n";
import { POSITION_LABEL, POSITION_LABEL_EU } from "@/lib/fantasy/types";

export const Route = createFileRoute("/admin/posiciones")({
  head: () => ({
    meta: [
      { title: "Posiciones de jugadores · BZG Fantasy" },
      { name: "description", content: "Añade o quita posiciones a cualquier jugador/a del club." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminPosiciones />
    </AdminGuard>
  ),
});

type PlayerRow = {
  id: string;
  nombre: string;
  apellido1: string | null;
  es_entrenador: boolean;
  teams: string[];
};
type PosRow = { player_id: string; position_id: string; es_principal: boolean };

function AdminPosiciones() {
  const t = useT();
  const { lang } = useLang();
  const POS_LABEL = lang === "eu" ? POSITION_LABEL_EU : POSITION_LABEL;
  const { canManageAll } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [principal, setPrincipal] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const q = useQuery({
    queryKey: ["admin-posiciones"],
    queryFn: async () => {
      const [playersRes, teamsRes, linksRes, posRes, ppRes] = await Promise.all([
        supabase
          .from("club_players")
          .select("id,nombre,apellido1,es_entrenador")
          .eq("activo", true)
          .order("nombre"),
        supabase.from("club_teams").select("id,nombre,club_seasons!inner(is_active)").eq("club_seasons.is_active", true),
        supabase.from("club_player_teams").select("player_id,team_id"),
        supabase.from("club_positions").select("id,nombre,orden").order("orden"),
        supabase.from("club_player_positions").select("player_id,position_id,es_principal"),
      ]);
      for (const r of [playersRes, teamsRes, linksRes, posRes, ppRes]) if (r.error) throw r.error;
      const teamName = new Map((teamsRes.data ?? []).map((tm) => [tm.id, tm.nombre]));
      const teamsByPlayer = new Map<string, string[]>();
      for (const l of linksRes.data ?? []) {
        const arr = teamsByPlayer.get(l.player_id) ?? [];
        const name = teamName.get(l.team_id);
        if (name) arr.push(name);
        teamsByPlayer.set(l.player_id, arr);
      }
      const players: PlayerRow[] = (playersRes.data ?? []).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        apellido1: p.apellido1,
        es_entrenador: p.es_entrenador,
        teams: teamsByPlayer.get(p.id) ?? [],
      }));
      return {
        players,
        positions: posRes.data ?? [],
        playerPositions: (ppRes.data ?? []) as PosRow[],
      };
    },
  });

  const filtered = useMemo(() => {
    const list = q.data?.players ?? [];
    const f = filter.trim().toLowerCase();
    if (!f) return list;
    return list.filter(
      (p) =>
        p.nombre.toLowerCase().includes(f) ||
        (p.apellido1 ?? "").toLowerCase().includes(f) ||
        p.teams.some((tm) => tm.toLowerCase().includes(f)),
    );
  }, [q.data, filter]);

  const selectPlayer = (p: PlayerRow) => {
    setSelectedId(p.id);
    setMsg(null);
    const rows = (q.data?.playerPositions ?? []).filter((r) => r.player_id === p.id);
    setChecked(new Set(rows.map((r) => r.position_id)));
    setPrincipal(rows.find((r) => r.es_principal)?.position_id ?? rows[0]?.position_id ?? null);
  };

  const toggle = (posId: string) => {
    const next = new Set(checked);
    if (next.has(posId)) {
      next.delete(posId);
      if (principal === posId) setPrincipal(null);
    } else {
      next.add(posId);
      if (!principal) setPrincipal(posId);
    }
    setChecked(next);
  };

  const save = async () => {
    if (!selectedId) return;
    setBusy(true);
    setMsg(null);
    const prin = principal && checked.has(principal) ? principal : [...checked][0] ?? null;
    const { error: delErr } = await supabase
      .from("club_player_positions")
      .delete()
      .eq("player_id", selectedId);
    if (!delErr && checked.size > 0) {
      const rows = [...checked].map((position_id) => ({
        player_id: selectedId,
        position_id,
        es_principal: position_id === prin,
      }));
      const { error: insErr } = await supabase.from("club_player_positions").insert(rows);
      if (insErr) setMsg(insErr.message);
    } else if (delErr) {
      setMsg(delErr.message);
    }
    setBusy(false);
    if (!msg) {
      setMsg(t("Posizioak gordeta.", "Posiciones guardadas."));
      qc.invalidateQueries({ queryKey: ["admin-posiciones"] });
    }
  };

  if (!canManageAll) {
    return (
      <div className="mx-auto max-w-md p-10 text-center text-sm text-muted-foreground">
        {t("super_admin bakarrik.", "Sólo super_admin.")}
      </div>
    );
  }

  const selected = q.data?.players.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <BackButton />
      <h1 className="mt-3 font-display text-4xl">{t("Jokalarien posizioak", "Posiciones de jugadores/as")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(
          "Hautatu jokalari bat eta markatu edo desmarkatu bere posizioak. Gorde botoiak posizioak bakarrik eguneratzen ditu.",
          "Selecciona un jugador/a y marca o desmarca sus posiciones. Guardar actualiza únicamente las posiciones.",
        )}
      </p>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t("Bilatu jokalaria edo taldea…", "Buscar jugador/a o equipo…")}
        className="mt-6 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
      />

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="max-h-[32rem] space-y-1 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-card">
          {q.isLoading && (
            <p className="p-4 text-center text-sm text-muted-foreground">{t("Kargatzen…", "Cargando…")}</p>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPlayer(p)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                selectedId === p.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"
              }`}
            >
              <span translate="no" className="font-semibold">
                {p.nombre}
                {p.apellido1 ? ` ${p.apellido1}` : ""}
              </span>
              <span className="block text-xs text-muted-foreground">
                {p.teams.join(" · ") || t("Talderik gabe", "Sin equipo")}
                {p.es_entrenador ? ` · ${t("Entrenatzailea", "Entrenador/a")}` : ""}
              </span>
            </button>
          ))}
          {!q.isLoading && filtered.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {t("Ez da emaitzarik", "Sin resultados")}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              {t("Hautatu jokalari bat ezkerreko zerrendan.", "Selecciona un jugador/a en la lista de la izquierda.")}
            </p>
          ) : (
            <>
              <div translate="no" className="font-display text-xl">
                {selected.nombre}
                {selected.apellido1 ? ` ${selected.apellido1}` : ""}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{selected.teams.join(" · ")}</div>
              <div className="mt-4 space-y-2">
                {(q.data?.positions ?? []).map((pos) => (
                  <label
                    key={pos.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked.has(pos.id)}
                        onChange={() => toggle(pos.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      {POS_LABEL[pos.id as keyof typeof POS_LABEL] ?? pos.nombre}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <input
                        type="radio"
                        name="principal"
                        disabled={!checked.has(pos.id)}
                        checked={principal === pos.id}
                        onChange={() => setPrincipal(pos.id)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      {t("Nagusia", "Principal")}
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={save}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {t("Gorde", "Guardar")}
              </button>
              {msg && <p className="mt-2 text-sm">{msg}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
