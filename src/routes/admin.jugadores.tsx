import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useT, useLang } from "@/lib/i18n";
import { POSITION_LABEL, POSITION_LABEL_EU } from "@/lib/fantasy/types";

export const Route = createFileRoute("/admin/jugadores")({
  head: () => ({
    meta: [
      { title: "Gestión de jugadores · BZG Fantasy" },
      { name: "description", content: "Crea, edita o desactiva jugadores/as del club conservando su historial." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminJugadores />
    </AdminGuard>
  ),
});

type Sexo = "masculino" | "femenino";
type Estado = "disponible" | "dudoso" | "no_disponible";
type Form = {
  id: string | null;
  nombre: string;
  apellido1: string;
  apellido2: string;
  alias: string;
  sexo: Sexo;
  anio_nacimiento: string;
  dorsal: string;
  estado: Estado;
  es_entrenador: boolean;
  activo: boolean;
  teams: string[];
  positions: string[];
  principal: string | null;
};

const EMPTY: Form = {
  id: null,
  nombre: "",
  apellido1: "",
  apellido2: "",
  alias: "",
  sexo: "masculino",
  anio_nacimiento: "",
  dorsal: "",
  estado: "disponible",
  es_entrenador: false,
  activo: true,
  teams: [],
  positions: [],
  principal: null,
};

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

function AdminJugadores() {
  const t = useT();
  const { lang } = useLang();
  const POS_LABEL = lang === "eu" ? POSITION_LABEL_EU : POSITION_LABEL;
  const { canManageAll } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-jugadores"],
    queryFn: async () => {
      const [pl, tm, lk, pos, pp] = await Promise.all([
        supabase
          .from("club_players")
          .select("id,nombre,apellido1,apellido2,alias,sexo,anio_nacimiento,dorsal,estado,es_entrenador,activo")
          .order("nombre"),
        supabase
          .from("club_teams")
          .select("id,nombre,categoria,sexo,club_seasons!inner(is_active)")
          .eq("club_seasons.is_active", true),
        supabase.from("club_player_teams").select("player_id,team_id"),
        supabase.from("club_positions").select("id,nombre,orden").order("orden"),
        supabase.from("club_player_positions").select("player_id,position_id,es_principal"),
      ]);
      for (const r of [pl, tm, lk, pos, pp]) if (r.error) throw r.error;
      return {
        players: pl.data ?? [],
        teams: tm.data ?? [],
        links: lk.data ?? [],
        positions: pos.data ?? [],
        playerPositions: pp.data ?? [],
      };
    },
  });

  const teamName = useMemo(() => new Map((q.data?.teams ?? []).map((x) => [x.id, x.nombre])), [q.data]);
  const teamsOf = (id: string) =>
    (q.data?.links ?? []).filter((l) => l.player_id === id && teamName.has(l.team_id)).map((l) => l.team_id);

  const list = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const all = q.data?.players ?? [];
    if (!f) return all;
    return all.filter(
      (p) =>
        p.nombre.toLowerCase().includes(f) ||
        (p.apellido1 ?? "").toLowerCase().includes(f) ||
        teamsOf(p.id).some((id) => (teamName.get(id) ?? "").toLowerCase().includes(f)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, filter, teamName]);

  const edit = (p: NonNullable<typeof q.data>["players"][number]) => {
    const rows = (q.data?.playerPositions ?? []).filter((r) => r.player_id === p.id);
    setMsg(null);
    setForm({
      id: p.id,
      nombre: p.nombre,
      apellido1: p.apellido1 ?? "",
      apellido2: p.apellido2 ?? "",
      alias: p.alias ?? "",
      sexo: p.sexo as Sexo,
      anio_nacimiento: p.anio_nacimiento?.toString() ?? "",
      dorsal: p.dorsal?.toString() ?? "",
      estado: p.estado as Estado,
      es_entrenador: p.es_entrenador,
      activo: p.activo,
      teams: teamsOf(p.id),
      positions: rows.map((r) => r.position_id),
      principal: rows.find((r) => r.es_principal)?.position_id ?? rows[0]?.position_id ?? null,
    });
  };

  const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const save = async () => {
    if (!form) return;
    if (!form.nombre.trim()) return setMsg(t("Izena derrigorrezkoa da.", "El nombre es obligatorio."));
    if (form.teams.length === 0) return setMsg(t("Aukeratu talde bat gutxienez.", "Selecciona al menos un equipo."));
    setBusy(true);
    setMsg(null);
    const principal = form.principal && form.positions.includes(form.principal) ? form.principal : form.positions[0] ?? null;
    const { data, error } = await supabase.rpc("admin_save_player", {
      _id: form.id as string,
      _nombre: form.nombre,
      _apellido1: form.apellido1,
      _apellido2: form.apellido2,
      _alias: form.alias,
      _sexo: form.sexo,
      _anio_nacimiento: form.anio_nacimiento ? Number(form.anio_nacimiento) : (null as unknown as number),
      _dorsal: form.dorsal ? Number(form.dorsal) : (null as unknown as number),
      _estado: form.estado,
      _es_entrenador: form.es_entrenador,
      _activo: form.activo,
      _team_ids: form.teams,
      _positions: form.positions,
      _principal: principal as string,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setForm({ ...form, id: data as string, principal });
    setMsg(t("Gordeta.", "Guardado."));
    qc.invalidateQueries();
  };

  if (!canManageAll)
    return (
      <div className="mx-auto max-w-md p-10 text-center text-sm text-muted-foreground">
        {t("super_admin bakarrik.", "Sólo super_admin.")}
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <BackButton />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl">{t("Jokalarien kudeaketa", "Gestión de jugadores/as")}</h1>
        <button
          type="button"
          onClick={() => {
            setMsg(null);
            setForm({ ...EMPTY });
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> {t("Jokalari berria", "Nuevo jugador/a")}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(
          "Desaktibatutako jokalariak ez dira agertuko sobreetan, lerrokatzeetan, Errendimenduan, Taldeetan edo sailkapenean. Itxitako jardunaldiak eta puntuak gordetzen dira.",
          "Los jugadores/as desactivados no aparecen en sobres, alineaciones, Desempeño, Equipos ni Clasificación. Las jornadas cerradas y sus puntos se conservan.",
        )}
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.3fr]">
        <div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("Bilatu jokalaria edo taldea…", "Buscar jugador/a o equipo…")}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
          <div className="mt-3 max-h-[36rem] space-y-1 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-card">
            {q.isLoading && (
              <p className="p-4 text-center text-sm text-muted-foreground">{t("Kargatzen…", "Cargando…")}</p>
            )}
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => edit(p)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  form?.id === p.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                } ${p.activo ? "" : "opacity-60"}`}
              >
                <span translate="no" className={`font-semibold ${p.activo ? "" : "line-through"}`}>
                  {p.nombre}
                  {p.apellido1 ? ` ${p.apellido1}` : ""}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {teamsOf(p.id).map((id) => teamName.get(id)).join(" · ") || t("Talderik gabe", "Sin equipo")}
                  {p.es_entrenador ? ` · ${t("Entrenatzailea", "Entrenador/a")}` : ""}
                  {!p.activo ? ` · ${t("Desaktibatuta", "Desactivado/a")}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          {!form ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("Hautatu jokalari bat edo sortu berri bat.", "Selecciona un jugador/a o crea uno nuevo.")}
            </p>
          ) : (
            <div className="space-y-4">
              <h2 className="font-display text-2xl">
                {form.id ? t("Editatu", "Editar") : t("Jokalari berria", "Nuevo jugador/a")}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("Izena", "Nombre")}>
                  <input className={input} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </Field>
                <Field label={t("Ezizena", "Alias")}>
                  <input className={input} value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
                </Field>
                <Field label={t("1. abizena", "Primer apellido")}>
                  <input className={input} value={form.apellido1} onChange={(e) => setForm({ ...form, apellido1: e.target.value })} />
                </Field>
                <Field label={t("2. abizena", "Segundo apellido")}>
                  <input className={input} value={form.apellido2} onChange={(e) => setForm({ ...form, apellido2: e.target.value })} />
                </Field>
                <Field label={t("Dortsala", "Dorsal")}>
                  <input type="number" className={input} value={form.dorsal} onChange={(e) => setForm({ ...form, dorsal: e.target.value })} />
                </Field>
                <Field label={t("Jaiotze-urtea", "Año de nacimiento")}>
                  <input
                    type="number"
                    className={input}
                    value={form.anio_nacimiento}
                    onChange={(e) => setForm({ ...form, anio_nacimiento: e.target.value })}
                  />
                </Field>
                <Field label={t("Sexua", "Sexo")}>
                  <select className={input} value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value as Sexo })}>
                    <option value="masculino">{t("Gizonezkoa", "Masculino")}</option>
                    <option value="femenino">{t("Emakumezkoa", "Femenino")}</option>
                  </select>
                </Field>
                <Field label={t("Egoera", "Estado")}>
                  <select className={input} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as Estado })}>
                    <option value="disponible">{t("Eskuragarri", "Disponible")}</option>
                    <option value="dudoso">{t("Zalantzazkoa", "Dudoso")}</option>
                    <option value="no_disponible">{t("Ez eskuragarri", "No disponible")}</option>
                  </select>
                </Field>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.es_entrenador}
                    onChange={(e) => setForm({ ...form, es_entrenador: e.target.checked })}
                  />
                  {t("Entrenatzailea", "Entrenador/a")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
                  {t("Aktiboa", "Activo/a")}
                </label>
              </div>

              <Field label={t("Taldeak", "Equipos")}>
                <div className="grid gap-1 sm:grid-cols-2">
                  {(q.data?.teams ?? []).map((tm) => (
                    <label key={tm.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.teams.includes(tm.id)}
                        onChange={() => setForm({ ...form, teams: toggleIn(form.teams, tm.id) })}
                      />
                      <span translate="no">{tm.nombre}</span>
                    </label>
                  ))}
                </div>
              </Field>

              {!form.es_entrenador && (
                <Field label={t("Posizioak (● nagusia)", "Posiciones (● principal)")}>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {(q.data?.positions ?? []).map((pos) => (
                      <div key={pos.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.positions.includes(pos.id)}
                          onChange={() => {
                            const positions = toggleIn(form.positions, pos.id);
                            const principal =
                              form.principal && positions.includes(form.principal) ? form.principal : positions[0] ?? null;
                            setForm({ ...form, positions, principal });
                          }}
                        />
                        <span className="flex-1">{POS_LABEL[pos.id as keyof typeof POS_LABEL] ?? pos.nombre}</span>
                        {form.positions.includes(pos.id) && (
                          <input
                            type="radio"
                            name="principal"
                            checked={form.principal === pos.id}
                            onChange={() => setForm({ ...form, principal: pos.id })}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </Field>
              )}

              {msg && <p className="text-sm text-primary">{msg}</p>}
              <button
                type="button"
                disabled={busy}
                onClick={save}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {t("Gorde", "Guardar")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
