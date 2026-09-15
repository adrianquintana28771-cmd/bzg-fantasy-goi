import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Sparkles, X, Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Posicion = Database["public"]["Enums"]["plantilla_posicion"];
type Rareza = "normal" | "raro" | "legendario";

const MAX_USOS = 3;

const RAREZA_MULT: Record<Rareza, number> = { normal: 1, raro: 1.3, legendario: 1.5 };
const RAREZA_LABEL: Record<Rareza, string> = { normal: "Normal", raro: "Raro", legendario: "Legendario" };
const RAREZA_STYLE: Record<Rareza, string> = {
  normal: "border-border bg-background",
  raro: "border-sky-500/60 bg-sky-500/10",
  legendario: "border-[color:var(--gold,#d4a017)] bg-[color:var(--gold,#d4a017)]/15",
};

/** Puntuación final de la carta: máximo 2 dígitos */
function cartaPuntos(rating: number, rareza: Rareza) {
  return Math.min(99, Math.round(rating * RAREZA_MULT[rareza]));
}

const POS_LABEL: Record<Posicion, string> = {
  portero: "Portero",
  extremo_izq: "Extremo Izq.",
  extremo_der: "Extremo Der.",
  lateral_izq: "Lateral Izq.",
  lateral_der: "Lateral Der.",
  central: "Central",
  pivote: "Pivote",
};

const POS_SHORT: Record<Posicion, string> = {
  portero: "PT", extremo_izq: "EI", extremo_der: "ED",
  lateral_izq: "LI", lateral_der: "LD", central: "C", pivote: "P",
};

const SLOTS: Posicion[] = [
  "portero", "extremo_izq", "extremo_der", "lateral_izq", "lateral_der", "central", "pivote",
];

const SLOT_XY: Record<Posicion, { x: number; y: number }> = {
  portero: { x: 50, y: 88 },
  extremo_izq: { x: 12, y: 30 },
  extremo_der: { x: 88, y: 30 },
  lateral_izq: { x: 28, y: 55 },
  lateral_der: { x: 72, y: 55 },
  central: { x: 50, y: 45 },
  pivote: { x: 50, y: 22 },
};

export const Route = createFileRoute("/plantilla")({
  head: () => ({
    meta: [
      { title: "Mi equipo · BZG Fantasy" },
      { name: "description", content: "Alinea a tus jugadores en el medio campo y gestiona tus cartas de BZG Fantasy." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlantillaPage,
});

interface PoolRow { id: string; nombre: string; posicion: Posicion; rating: number; rareza: Rareza }
interface CopyRow { id: string; player_id: string; usos: number; player_pool: PoolRow | null }
interface JornadaRow { id: string; numero: number; nombre: string; is_active: boolean; is_locked: boolean }
interface LineupRow {
  id: string; jornada_id: string; locked: boolean;
  portero: string | null; extremo_izq: string | null; extremo_der: string | null;
  lateral_izq: string | null; lateral_der: string | null; central: string | null; pivote: string | null;
}

function PlantillaPage() {
  const { user, loading, isSuperAdmin, isAdmin, isManager } = useAuth();

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-center text-muted-foreground">Cargando…</div>;
  }

  if (user && !isSuperAdmin && (isAdmin || isManager)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <BackButton />
        <h1 className="mt-4 font-display text-3xl">Sección de juego</h1>
        <p className="mt-2 text-muted-foreground">
          Las cuentas de administración no tienen equipo, sobres ni misiones. Tu trabajo es registrar
          el desempeño de los jugadores/as.
        </p>
        <Link to="/admin/desempeno" className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Ir a Desempeño
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <BackButton />
        <h1 className="mt-4 font-display text-3xl">Mi equipo</h1>
        <p className="mt-2 text-muted-foreground">Inicia sesión para crear tu equipo y alinear a tus jugadores.</p>
        <Link to="/auth" className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Entrar</Link>
      </div>
    );
  }

  return <Inner userId={user.id} />;
}

function Inner({ userId }: { userId: string }) {
  const qc = useQueryClient();

  const wallet = useQuery({
    queryKey: ["wallet", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_wallet")
        .select("sobres, sobres_premium")
        .eq("user_id", userId)
        .maybeSingle();
      return { sobres: data?.sobres ?? 0, premium: (data as { sobres_premium?: number } | null)?.sobres_premium ?? 0 };
    },
  });

  const inventory = useQuery({
    queryKey: ["inventory", userId],
    queryFn: async (): Promise<CopyRow[]> => {
      const { data, error } = await supabase
        .from("user_players")
        .select("id, player_id, usos, player_pool(id, nombre, posicion, rating, rareza)")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as unknown as CopyRow[];
    },
  });

  const jornada = useQuery({
    queryKey: ["jornada-activa"],
    queryFn: async (): Promise<JornadaRow | null> => {
      const { data } = await supabase.from("jornadas").select("*").eq("is_active", true).order("numero", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const lineup = useQuery({
    queryKey: ["lineup", userId, jornada.data?.id],
    enabled: !!jornada.data?.id,
    queryFn: async (): Promise<LineupRow | null> => {
      const { data } = await supabase
        .from("lineups").select("*")
        .eq("user_id", userId).eq("jornada_id", jornada.data!.id)
        .maybeSingle();
      return data as LineupRow | null;
    },
  });

  /** Cartas agrupadas por jugador (puede haber repetidos) */
  const cards = useMemo(() => {
    const map = new Map<string, { pool: PoolRow; copias: CopyRow[] }>();
    (inventory.data ?? []).forEach((c) => {
      if (!c.player_pool) return;
      const entry = map.get(c.player_id) ?? { pool: c.player_pool, copias: [] };
      entry.copias.push(c);
      map.set(c.player_id, entry);
    });
    return [...map.values()].map(({ pool, copias }) => {
      const disponibles = copias.filter((c) => c.usos < MAX_USOS).sort((a, b) => b.usos - a.usos);
      const activa = disponibles[0];
      return {
        pool,
        total: copias.length,
        disponibles: disponibles.length,
        usosRestantes: activa ? MAX_USOS - activa.usos : 0,
        usable: !!activa,
      };
    }).sort((a, b) => cartaPuntos(b.pool.rating, b.pool.rareza) - cartaPuntos(a.pool.rating, a.pool.rareza));
  }, [inventory.data]);

  const [slotDraft, setSlotDraft] = useState<Record<Posicion, string | null>>({
    portero: null, extremo_izq: null, extremo_der: null,
    lateral_izq: null, lateral_der: null, central: null, pivote: null,
  });
  const [dirty, setDirty] = useState(false);
  const [pickSlot, setPickSlot] = useState<Posicion | null>(null);
  const [sobreResult, setSobreResult] = useState<Array<{ id: string; nombre: string; posicion: Posicion; rating: number; rareza: Rareza }> | null>(null);

  useEffect(() => {
    if (lineup.data) {
      setSlotDraft({
        portero: lineup.data.portero,
        extremo_izq: lineup.data.extremo_izq,
        extremo_der: lineup.data.extremo_der,
        lateral_izq: lineup.data.lateral_izq,
        lateral_der: lineup.data.lateral_der,
        central: lineup.data.central,
        pivote: lineup.data.pivote,
      });
      setDirty(false);
    }
  }, [lineup.data]);

  const openSobreMut = useMutation({
    mutationFn: async (tipo: "normal" | "premium") => {
      const { data, error } = await (supabase.rpc as unknown as (
        f: string, a: Record<string, unknown>,
      ) => Promise<{ data: Array<{ p_id: string; p_nombre: string; p_posicion: Posicion; p_rating: number; p_rareza: Rareza }> | null; error: { message: string } | null }>)(
        "open_sobre", { _tipo: tipo },
      );
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        id: r.p_id, nombre: r.p_nombre, posicion: r.p_posicion, rating: r.p_rating, rareza: r.p_rareza,
      }));
    },
    onSuccess: (data) => {
      setSobreResult(data);
      qc.invalidateQueries({ queryKey: ["wallet", userId] });
      qc.invalidateQueries({ queryKey: ["inventory", userId] });
    },
    onError: (e: Error) => toast.error(e.message.includes("premium") ? "No tienes sobres premium" : "No tienes sobres disponibles"),
  });

  const saveLineupMut = useMutation({
    mutationFn: async () => {
      if (!jornada.data) throw new Error("No hay jornada activa");
      const { error } = await supabase
        .from("lineups")
        .upsert({ user_id: userId, jornada_id: jornada.data.id, ...slotDraft }, { onConflict: "user_id,jornada_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alineación guardada");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["lineup", userId] });
    },
    onError: (e: Error) => toast.error(e.message ?? "No se pudo guardar"),
  });

  const alignedIds = new Set(Object.values(slotDraft).filter(Boolean) as string[]);
  const locked = !!lineup.data?.locked || !!jornada.data?.is_locked;

  const cardById = (id: string | null | undefined) => (id ? cards.find((c) => c.pool.id === id) ?? null : null);

  const eligibleForSlot = (slot: Posicion) =>
    cards.filter((c) => c.pool.posicion === slot && c.usable && (!alignedIds.has(c.pool.id) || slotDraft[slot] === c.pool.id));

  /** Puntuación estimada de la jornada (máx. 2 dígitos) */
  const puntosJornada = Math.min(
    99,
    Math.round(
      (Object.values(slotDraft).filter(Boolean) as string[])
        .reduce((acc, id) => acc + (cardById(id) ? cartaPuntos(cardById(id)!.pool.rating, cardById(id)!.pool.rareza) : 0), 0) / 7,
    ),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <BackButton />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-none">Mi equipo</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            {jornada.data ? `${jornada.data.nombre} · ${jornada.data.is_locked ? "bloqueada" : "activa"}` : "Sin jornada activa"}
          </p>
        </div>
        <div className="rounded-xl bg-primary/10 px-4 py-2 text-center">
          <div className="font-display text-2xl text-primary">{puntosJornada}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">pts jornada</div>
        </div>
      </header>

      {/* Sobres */}
      <section className="grid grid-cols-2 gap-3">
        <button
          onClick={() => openSobreMut.mutate("normal")}
          disabled={openSobreMut.isPending || (wallet.data?.sobres ?? 0) <= 0}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm font-semibold disabled:opacity-40"
        >
          <Package className="h-5 w-5 text-primary" /> Sobre normal ({wallet.data?.sobres ?? 0})
        </button>
        <button
          onClick={() => openSobreMut.mutate("premium")}
          disabled={openSobreMut.isPending || (wallet.data?.premium ?? 0) <= 0}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[color:var(--gold,#d4a017)] bg-card p-3 text-sm font-bold disabled:opacity-40"
        >
          <Sparkles className="h-5 w-5 text-[color:var(--gold,#d4a017)]" /> Premium ({wallet.data?.premium ?? 0})
        </button>
      </section>

      {/* Medio campo */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-lg">Alineación de la jornada</h2>
          {locked ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Bloqueada
            </span>
          ) : (
            <button
              onClick={() => saveLineupMut.mutate()}
              disabled={!dirty || saveLineupMut.isPending || !jornada.data}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--gold,#d4a017)] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" /> Guardar
            </button>
          )}
        </div>
        <Court>
          {SLOTS.map((slot) => {
            const c = cardById(slotDraft[slot]);
            const { x, y } = SLOT_XY[slot];
            return (
              <button
                key={slot}
                type="button"
                onClick={() => !locked && setPickSlot(slot)}
                disabled={locked}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div className={`flex flex-col items-center gap-1 ${locked ? "opacity-90" : "transition hover:scale-105"}`}>
                  <div className={`grid h-14 w-14 place-items-center rounded-full border-2 font-display text-sm shadow-lg ${
                    c ? "border-primary bg-primary text-primary-foreground" : "border-dashed border-white/70 bg-black/30 text-white"
                  }`}>
                    {c ? cartaPuntos(c.pool.rating, c.pool.rareza) : POS_SHORT[slot]}
                  </div>
                  <div className="max-w-[90px] truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {c ? c.pool.nombre : POS_LABEL[slot]}
                  </div>
                </div>
              </button>
            );
          })}
        </Court>
      </section>

      {/* Mis jugadores */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-lg">Mis jugadores ({cards.length})</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no tienes jugadores. Completa <Link to="/misiones" className="text-primary underline">misiones</Link> para conseguir sobres.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cards.map((c) => {
              const enPista = alignedIds.has(c.pool.id);
              return (
                <li key={c.pool.id} className={`rounded-lg border-2 p-2 text-xs ${enPista ? "border-primary bg-primary/5" : RAREZA_STYLE[c.pool.rareza]}`}>
                  <div className="flex items-center justify-between gap-1">
                    <div className="truncate font-semibold">{c.pool.nombre}</div>
                    <div className="font-display text-base text-primary">{cartaPuntos(c.pool.rating, c.pool.rareza)}</div>
                  </div>
                  <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{POS_LABEL[c.pool.posicion]}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase">{RAREZA_LABEL[c.pool.rareza]} ·x{RAREZA_MULT[c.pool.rareza]}</span>
                    {c.total > 1 && <span className="rounded bg-secondary px-1 text-[10px] font-bold">x{c.total}</span>}
                  </div>
                  <div className={`text-[10px] font-semibold ${c.usosRestantes <= 1 ? "text-destructive" : "text-muted-foreground"}`}>
                    Usos {c.usosRestantes}/{MAX_USOS}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Resultado del sobre */}
      <Dialog open={!!sobreResult} onOpenChange={(o) => !o && setSobreResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">¡Nuevo sobre!</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {(sobreResult ?? []).map((p, i) => (
              <div key={`${p.id}-${i}`} className={`rounded-lg border-2 p-3 text-center ${RAREZA_STYLE[p.rareza]}`}>
                <div className="font-display text-3xl text-primary">{cartaPuntos(p.rating, p.rareza)}</div>
                <div className="truncate text-xs font-semibold">{p.nombre}</div>
                <div className="text-[10px] uppercase text-muted-foreground">{RAREZA_LABEL[p.rareza]}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Elegir jugador para un hueco */}
      <Dialog open={!!pickSlot} onOpenChange={(o) => !o && setPickSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elegir {pickSlot ? POS_LABEL[pickSlot] : ""}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {pickSlot && slotDraft[pickSlot] && (
              <button
                onClick={() => { setSlotDraft((d) => ({ ...d, [pickSlot!]: null })); setDirty(true); setPickSlot(null); }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs font-semibold text-destructive"
              >
                <X className="h-3 w-3" /> Quitar del hueco
              </button>
            )}
            {pickSlot && eligibleForSlot(pickSlot).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tienes jugadores para este hueco. Abre un sobre.
              </p>
            )}
            {pickSlot && eligibleForSlot(pickSlot).map((c) => (
              <button
                key={c.pool.id}
                onClick={() => { setSlotDraft((d) => ({ ...d, [pickSlot!]: c.pool.id })); setDirty(true); setPickSlot(null); }}
                className={`flex w-full items-center justify-between rounded-lg border-2 p-3 text-left ${RAREZA_STYLE[c.pool.rareza]}`}
              >
                <div>
                  <div className="font-semibold">{c.pool.nombre}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">
                    {POS_LABEL[c.pool.posicion]} · {RAREZA_LABEL[c.pool.rareza]}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg text-primary">{cartaPuntos(c.pool.rating, c.pool.rareza)}</div>
                  <div className="text-[10px] text-muted-foreground">Usos {c.usosRestantes}/{MAX_USOS}</div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Court({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full" style={{ aspectRatio: "1 / 1.25" }}>
      <svg viewBox="0 0 100 125" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="courtGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f8b4d" />
            <stop offset="1" stopColor="#1f6b39" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="125" fill="url(#courtGrad)" />
        <rect x="3" y="3" width="94" height="119" fill="none" stroke="white" strokeWidth="0.5" opacity="0.85" />
        <path d="M 15 100 Q 50 60 85 100" fill="none" stroke="white" strokeWidth="0.4" strokeDasharray="1.5,1.5" opacity="0.9" />
        <path d="M 22 112 Q 50 80 78 112" fill="none" stroke="white" strokeWidth="0.5" opacity="0.9" />
        <rect x="40" y="118" width="20" height="4" fill="none" stroke="white" strokeWidth="0.6" opacity="0.95" />
      </svg>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
