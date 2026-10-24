import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import type { Tramo } from "@/lib/club-data";

export const Route = createFileRoute("/admin/reglas")({
  head: () => ({
    meta: [
      { title: "Criterios de puntuación · Admin BZG" },
      {
        name: "description",
        content: "Crea y edita los criterios de puntuación del Fantasy del club.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Criterios de puntuación · Admin BZG" },
      { property: "og:description", content: "Gestión de criterios de puntuación de BZG Fantasy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <SuperOnly>
        <Reglas />
      </SuperOnly>
    </AdminGuard>
  ),
});

function SuperOnly({ children }: { children: React.ReactNode }) {
  const { canManageAll } = useAuth();
  const { t } = useLang();
  if (!canManageAll) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-warning" />
        <h1 className="mt-3 font-display text-3xl">{t("super_admin bakarrik", "Sólo super_admin")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "Puntuazio-irizpideak editatzea super_admin rolari dagokio.",
            "Editar los criterios de puntuación está reservado al rol super_admin.",
          )}
        </p>
        <Link to="/admin" className="mt-6 inline-block text-primary hover:underline">
          {t("Panelera itzuli", "Volver al panel")}
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

interface Criterio {
  id: string;
  nombre: string;
  puntos: number;
  grupo: string;
  solo_portero: boolean;
  solo_entrenador: boolean;
  es_resultado: string | null;
  activo: boolean;
  orden: number;
  tramos: Tramo[] | null;
}

const GRUPOS = ["ataque", "defensa", "portero", "entrenador", "negativo", "bonus"];

function Reglas() {
  const qc = useQueryClient();
  const { t, td } = useLang();
  const [nuevo, setNuevo] = useState({
    nombre: "",
    puntos: 1,
    grupo: "ataque",
    solo_portero: false,
  });

  const criterios = useQuery({
    queryKey: ["criterios"],
    queryFn: async (): Promise<Criterio[]> => {
      const { data, error } = await supabase
        .from("club_action_types")
        .select("id,nombre,puntos,grupo,solo_portero,solo_entrenador,es_resultado,activo,orden,tramos")
        .order("orden");
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, puntos: Number(r.puntos) })) as Criterio[];
    },
  });

  const refrescar = () => {
    return qc.invalidateQueries();
  };

  const guardar = useMutation({
    mutationFn: async (c: { id: string; puntos?: number; nombre?: string; activo?: boolean }) => {
      const { id, ...campos } = c;
      const { error } = await supabase.from("club_action_types").update(campos).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Irizpidea gordeta · puntuazioak berriro kalkulatuta", "Criterio guardado · puntuaciones recalculadas"));
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message ?? t("Ezin izan da gorde", "No se pudo guardar")),
  });

  const crear = useMutation({
    mutationFn: async () => {
      const nombre = nuevo.nombre.trim();
      if (!nombre) throw new Error(t("Jarri izen bat irizpideari", "Pon un nombre al criterio"));
      const id = nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 40);
      const maxOrden = Math.max(0, ...(criterios.data ?? []).map((c) => c.orden));
      const { error } = await supabase.from("club_action_types").insert({
        id,
        nombre,
        puntos: nuevo.puntos,
        grupo: nuevo.grupo,
        solo_portero: nuevo.solo_portero,
        orden: maxOrden + 1,
        activo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Irizpidea sortuta. Adminen formularioan agertzen da jada.", "Criterio creado. Ya aparece en el formulario de los admins."));
      setNuevo({ nombre: "", puntos: 1, grupo: "ataque", solo_portero: false });
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const borrar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("club_action_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Irizpidea ezabatuta · puntuazioak berriro kalkulatuta", "Criterio eliminado · puntuaciones recalculadas"));
      refrescar();
    },
    onError: () => toast.error(t("Ezin izan da ezabatu (erabiltzen egon daiteke)", "No se pudo eliminar (puede estar en uso)")),
  });

  const lista = criterios.data ?? [];
  const entrenador = lista.filter((c) => c.solo_entrenador);
  const jugadores = lista.filter((c) => !c.solo_entrenador);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Admin
      </Link>
      <h1 className="mt-3 font-display text-4xl">{t("Puntuazio-irizpideak", "Criterios de puntuación")}</h1>
      <p className="text-sm text-muted-foreground">
        {t(
          "Aldaketa bat gordetzean, adminen formularioa berehala eguneratzen da eta iragandako jardunaldi guztiak berriro kalkulatzen dira: jokalari eta erabiltzaile bakoitzak puntu berriak izango ditu.",
          "Al guardar un cambio, el formulario de los admins se actualiza al momento y se recalculan todas las jornadas pasadas: cada jugador/a y cada usuario/a pasan a tener los puntos nuevos.",
        )}
      </p>

      {/* Nuevo criterio */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-card">
        <h2 className="font-display text-xl">{t("Irizpide berria gehitu", "Añadir criterio nuevo")}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            value={nuevo.nombre}
            onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
            placeholder={t("Adib. Gola nagusitasunean", "Ej. Gol en superioridad")}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.5"
            value={nuevo.puntos}
            onChange={(e) => setNuevo((n) => ({ ...n, puntos: Number(e.target.value) }))}
            className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-center font-display text-lg"
          />
          <select
            value={nuevo.grupo}
            onChange={(e) => setNuevo((n) => ({ ...n, grupo: e.target.value }))}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm capitalize"
          >
            {GRUPOS.map((g) => (
              <option key={g} value={g}>
                {td(g)}
              </option>
            ))}
          </select>
          <button
            onClick={() => crear.mutate()}
            disabled={crear.isPending}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {t("Sortu", "Crear")}
          </button>
        </div>
        <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={nuevo.solo_portero}
            onChange={(e) => setNuevo((n) => ({ ...n, solo_portero: e.target.checked }))}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          {t("Atezainentzat bakarrik", "Sólo para porteros/as")}
        </label>
      </div>

      <TramosPortero actions={criterios.data ?? []} />

      <Bloque
        titulo={t("Entrenatzaileak (emaitzaren arabera)", "Entrenadores/as (según el resultado)")}
        items={entrenador}
        guardar={guardar}
        borrar={borrar}
        fijo
      />
      <Bloque titulo={t("Jokalariak", "Jugadores/as")} items={jugadores} guardar={guardar} borrar={borrar} />
    </div>
  );
}

function Bloque({
  titulo,
  items,
  guardar,
  borrar,
  fijo,
}: {
  titulo: string;
  items: Criterio[];
  guardar: {
    mutate: (v: { id: string; puntos?: number; nombre?: string; activo?: boolean }) => void;
  };
  borrar: { mutate: (id: string) => void };
  fijo?: boolean;
}) {
  const { t } = useLang();
  return (
    <div className="mt-8">
      <h2 className="font-display text-2xl">{titulo}</h2>
      <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {items.map((c) => (
          <Fila key={c.id} c={c} guardar={guardar} borrar={borrar} fijo={fijo} />
        ))}
        {items.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("Irizpiderik ez.", "Sin criterios.")}</p>}
      </div>
    </div>
  );
}

const PCT_ID = "porcentaje_paradas";
const ACC_ID = "porcentaje_acierto";
const TRAMO_IDS = ["parada", "gol_encajado", PCT_ID, ACC_ID];

/** Editor super_admin de tramos de portero: se guarda en club_action_types.tramos y la BD recalcula sola. */
function TramosPortero({ actions }: { actions: Criterio[] }) {
  const { t, td } = useLang();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, Tramo[]>>({});
  useEffect(() => {
    const d: Record<string, Tramo[]> = {};
    for (const a of actions) if (TRAMO_IDS.includes(a.id)) d[a.id] = a.tramos ?? [];
    setDraft(d);
  }, [actions]);
  const [saving, setSaving] = useState("");

  async function guardar(id: string) {
    const tramos = (draft[id] ?? [])
      .filter((r) => Number.isFinite(r.desde) && Number.isFinite(r.puntos))
      .sort((a, b) => a.desde - b.desde);
    setSaving(id);
    const { error } = await supabase.from("club_action_types").update({ tramos } as never).eq("id", id);
    setSaving("");
    if (error) return toast.error(t("Ezin izan da gorde", "No se pudo guardar"));
    toast.success(t("Tarteak gordeta · puntuazioak berriro kalkulatuta", "Tramos guardados · puntuaciones recalculadas"));
    await qc.invalidateQueries();
  }

  const set = (id: string, i: number, k: keyof Tramo, v: string) =>
    setDraft((d) => ({
      ...d,
      [id]: d[id].map((r, j) => (j === i ? { ...r, [k]: v === "" && k === "hasta" ? null : Number(v) } : r)),
    }));

  return (
    <details className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-card">
      <summary className="cursor-pointer font-display text-lg">
        {t("Atezainen tarteak", "Tramos de porteros")}
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        {t(
          "Geldiketak eta golak: puntuak unitateko, tarteka metatuta (hutsik = lineala). Golak: atezain bakarra badago bakarrik; 2+ badaude, gol bakoitza irizpidearen puntuak. Ehunekoa: tarteko puntu finkoak, % = geldiketak / (geldiketak + kanpora + golak) × 100.",
          "Paradas y goles: puntos por unidad, acumulativos por tramos (vacío = lineal). Goles: solo si juega un único portero; con 2+ cada gol vale los puntos del criterio. Porcentaje: puntos fijos del tramo, % = paradas / (paradas + fuera + goles) × 100.",
        )}
      </p>
      {TRAMO_IDS.map((id) => {
        const a = actions.find((x) => x.id === id);
        if (!a) return null;
        const pctMode = id === PCT_ID || id === ACC_ID;
        return (
          <div key={id} className="mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{td(a.nombre)}</h3>
              <span className="text-xs text-muted-foreground">
                {pctMode ? "%" : t("puntuak unitateko", "puntos por unidad")}
              </span>
            </div>
            <div className="mt-2 grid gap-2">
              {(draft[id] ?? []).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span>{t("Nondik", "Desde")}</span>
                  <input type="number" step={pctMode ? "0.01" : "1"} value={r.desde} onChange={(e) => set(id, i, "desde", e.target.value)} className="w-20 rounded-md border border-input bg-background px-2 py-1" />
                  <span>{t("Nora", "Hasta")}</span>
                  <input type="number" step={pctMode ? "0.01" : "1"} value={r.hasta ?? ""} placeholder="∞" onChange={(e) => set(id, i, "hasta", e.target.value)} className="w-20 rounded-md border border-input bg-background px-2 py-1" />
                  <span>{t("Puntuak", "Puntos")}</span>
                  <input type="number" step="0.01" value={r.puntos} onChange={(e) => set(id, i, "puntos", e.target.value)} className="w-20 rounded-md border border-input bg-background px-2 py-1" />
                  <button type="button" aria-label={t("Ezabatu", "Eliminar")} onClick={() => setDraft((d) => ({ ...d, [id]: d[id].filter((_, j) => j !== i) }))} className="grid h-7 w-7 place-items-center rounded-md border border-destructive/40 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {(draft[id] ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {pctMode
                    ? t("Tarterik ez: ez du punturik ematen.", "Sin tramos: no suma puntos.")
                    : t(`Tarterik ez: lineala (${a.puntos} pt unitateko).`, `Sin tramos: lineal (${a.puntos} pts por unidad).`)}
                </p>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setDraft((d) => { const l = d[id] ?? []; const last = l[l.length - 1]; return { ...d, [id]: [...l, { desde: last ? (last.hasta ?? last.desde) + (pctMode ? 0.01 : 1) : pctMode ? 0 : 1, hasta: null, puntos: 0 }] }; })} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> {t("Tartea", "Tramo")}
              </button>
              <button type="button" disabled={saving === id} onClick={() => guardar(id)} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                <Save className="h-3.5 w-3.5" /> {t("Gorde", "Guardar")}
              </button>
            </div>
          </div>
        );
      })}
    </details>
  );
}

function Fila({
  c,
  guardar,
  borrar,
  fijo,
}: {
  c: Criterio;
  guardar: {
    mutate: (v: { id: string; puntos?: number; nombre?: string; activo?: boolean }) => void;
  };
  borrar: { mutate: (id: string) => void };
  fijo?: boolean;
}) {
  const [puntos, setPuntos] = useState(c.puntos);
  const [nombre, setNombre] = useState(c.nombre);
  const { t, td } = useLang();
  const nombreLimpio = nombre.trim();
  const nombreCambiado = nombreLimpio !== "" && nombreLimpio !== c.nombre;
  const cambiado = puntos !== c.puntos || nombreCambiado;
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <input
          type="checkbox"
          checked={c.activo}
          onChange={() => guardar.mutate({ id: c.id, activo: !c.activo })}
          aria-label={td(c.nombre)}
          className="h-4 w-4 accent-[var(--color-primary)]"
        />
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          aria-label={t("Irizpidearen izena", "Nombre del criterio")}
          className={`min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm ${c.activo ? "font-medium" : "text-muted-foreground line-through"}`}
        />
        {c.solo_portero && (
          <span className="rounded bg-secondary px-1 text-[10px] uppercase">{t("atezaina", "portero")}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.5"
          value={puntos}
          onChange={(e) => setPuntos(Number(e.target.value))}
          className={`w-20 rounded-md border border-input bg-background px-2 py-1.5 text-center font-display text-xl ${
            puntos < 0 ? "text-destructive" : "text-primary"
          }`}
        />
        <button
          onClick={() =>
            guardar.mutate({
              id: c.id,
              ...(puntos !== c.puntos ? { puntos } : {}),
              ...(nombreCambiado ? { nombre: nombreLimpio } : {}),
            })
          }
          disabled={!cambiado}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" /> {t("Gorde", "Guardar")}
        </button>
        {!fijo && (
          <button
            onClick={() => borrar.mutate(c.id)}
            aria-label={`${t("Ezabatu", "Eliminar")} ${td(c.nombre)}`}
            className="grid h-8 w-8 place-items-center rounded-md border border-destructive/40 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
