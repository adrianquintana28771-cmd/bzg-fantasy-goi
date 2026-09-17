import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/reglas")({
  head: () => ({
    meta: [
      { title: "Criterios de puntuación · Admin BZG" },
      { name: "description", content: "Crea y edita los criterios de puntuación del Fantasy del club." },
      { name: "robots", content: "noindex" },
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
  if (!canManageAll) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-warning" />
        <h1 className="mt-3 font-display text-3xl">Sólo super_admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Editar los criterios de puntuación está reservado al rol super_admin.
        </p>
        <Link to="/admin" className="mt-6 inline-block text-primary hover:underline">Volver al panel</Link>
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
}

const GRUPOS = ["ataque", "defensa", "portero", "entrenador", "negativo", "bonus"];

function Reglas() {
  const qc = useQueryClient();
  const [nuevo, setNuevo] = useState({ nombre: "", puntos: 1, grupo: "ataque", solo_portero: false });

  const criterios = useQuery({
    queryKey: ["criterios"],
    queryFn: async (): Promise<Criterio[]> => {
      const { data, error } = await supabase
        .from("club_action_types")
        .select("id,nombre,puntos,grupo,solo_portero,solo_entrenador,es_resultado,activo,orden")
        .order("orden");
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, puntos: Number(r.puntos) })) as Criterio[];
    },
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["criterios"] });
    qc.invalidateQueries({ queryKey: ["club_action_types"] });
    qc.invalidateQueries({ queryKey: ["historial-jornadas"] });
    qc.invalidateQueries({ queryKey: ["ranking-usuarios"] });
    qc.invalidateQueries({ queryKey: ["ranking-jugadores"] });
    qc.invalidateQueries({ queryKey: ["player-stats"] });
  };

  const guardar = useMutation({
    mutationFn: async (c: { id: string; puntos?: number; nombre?: string; activo?: boolean }) => {
      const { id, ...campos } = c;
      const { error } = await supabase.from("club_action_types").update(campos).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Criterio guardado · puntuaciones recalculadas");
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message ?? "No se pudo guardar"),
  });

  const crear = useMutation({
    mutationFn: async () => {
      const nombre = nuevo.nombre.trim();
      if (!nombre) throw new Error("Pon un nombre al criterio");
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
      toast.success("Criterio creado. Ya aparece en el formulario de los admins.");
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
      toast.success("Criterio eliminado · puntuaciones recalculadas");
      refrescar();
    },
    onError: () => toast.error("No se pudo eliminar (puede estar en uso)"),
  });

  const lista = criterios.data ?? [];
  const entrenador = lista.filter((c) => c.solo_entrenador);
  const jugadores = lista.filter((c) => !c.solo_entrenador);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Admin
      </Link>
      <h1 className="mt-3 font-display text-4xl">Criterios de puntuación</h1>
      <p className="text-sm text-muted-foreground">
        Al guardar un cambio, el formulario de los admins se actualiza al momento y se recalculan
        todas las jornadas pasadas: cada jugador/a y cada usuario/a pasan a tener los puntos nuevos.
      </p>

      {/* Nuevo criterio */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-card">
        <h2 className="font-display text-xl">Añadir criterio nuevo</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            value={nuevo.nombre}
            onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
            placeholder="Ej. Gol en superioridad"
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
            {GRUPOS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <button
            onClick={() => crear.mutate()}
            disabled={crear.isPending}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Crear
          </button>
        </div>
        <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={nuevo.solo_portero}
            onChange={(e) => setNuevo((n) => ({ ...n, solo_portero: e.target.checked }))}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Sólo para porteros/as
        </label>
      </div>

      <Bloque titulo="Entrenadores/as (según el resultado)" items={entrenador} guardar={guardar} borrar={borrar} fijo />
      <Bloque titulo="Jugadores/as" items={jugadores} guardar={guardar} borrar={borrar} />
    </div>
  );
}

function Bloque({
  titulo, items, guardar, borrar, fijo,
}: {
  titulo: string;
  items: Criterio[];
  guardar: { mutate: (v: { id: string; puntos?: number; nombre?: string; activo?: boolean }) => void };
  borrar: { mutate: (id: string) => void };
  fijo?: boolean;
}) {
  return (
    <div className="mt-8">
      <h2 className="font-display text-2xl">{titulo}</h2>
      <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {items.map((c) => <Fila key={c.id} c={c} guardar={guardar} borrar={borrar} fijo={fijo} />)}
        {items.length === 0 && <p className="p-4 text-sm text-muted-foreground">Sin criterios.</p>}
      </div>
    </div>
  );
}

function Fila({
  c, guardar, borrar, fijo,
}: {
  c: Criterio;
  guardar: { mutate: (v: { id: string; puntos?: number; nombre?: string; activo?: boolean }) => void };
  borrar: { mutate: (id: string) => void };
  fijo?: boolean;
}) {
  const [puntos, setPuntos] = useState(c.puntos);
  const cambiado = puntos !== c.puntos;
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <label className="flex min-w-0 flex-1 items-center gap-3">
        <input
          type="checkbox"
          checked={c.activo}
          onChange={() => guardar.mutate({ id: c.id, activo: !c.activo })}
          className="h-4 w-4 accent-[var(--color-primary)]"
        />
        <span className={`truncate ${c.activo ? "font-medium" : "text-muted-foreground line-through"}`}>
          {c.nombre}
          {c.solo_portero && <span className="ml-2 rounded bg-secondary px-1 text-[10px] uppercase">portero</span>}
        </span>
      </label>
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
          onClick={() => guardar.mutate({ id: c.id, puntos })}
          disabled={!cambiado}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" /> Guardar
        </button>
        {!fijo && (
          <button
            onClick={() => borrar.mutate(c.id)}
            aria-label={`Eliminar ${c.nombre}`}
            className="grid h-8 w-8 place-items-center rounded-md border border-destructive/40 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
