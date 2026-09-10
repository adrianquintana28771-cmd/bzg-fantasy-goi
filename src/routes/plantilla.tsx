import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Sparkles, Trophy, X, Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Posicion = Database["public"]["Enums"]["plantilla_posicion"];

const MAX_USOS = 5;

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
  portero: "PT",
  extremo_izq: "EI",
  extremo_der: "ED",
  lateral_izq: "LI",
  lateral_der: "LD",
  central: "C",
  pivote: "P",
};

const SLOTS: Posicion[] = [
  "portero",
  "extremo_izq",
  "extremo_der",
  "lateral_izq",
  "lateral_der",
  "central",
  "pivote",
];

// Court position for each slot (percent of container)
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
      { title: "Plantilla · BZG Fantasy" },
      { name: "description", content: "Tu plantilla Fantasy: abre sobres, misiones y alinea a 7 jugadores en la pista de balonmano." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlantillaPage,
});

interface PoolRow { id: string; nombre: string; posicion: Posicion; rating: number; team_id: string | null }
interface UserPlayerRow { player_id: string; player_pool: PoolRow | null }
interface UsageRow { player_id: string; usos_gastados: number }
interface JornadaRow { id: string; numero: number; nombre: string; is_active: boolean; is_locked: boolean }
interface LineupRow {
  id: string; jornada_id: string; locked: boolean;
  portero: string | null; extremo_izq: string | null; extremo_der: string | null;
  lateral_izq: string | null; lateral_der: string | null; central: string | null; pivote: string | null;
}
interface WalletRow { sobres: number }
interface MisionRow { id: string; nombre: string; descripcion: string; recompensa_sobres: number }

function PlantillaPage() {
  const { user, loading, isSuperAdmin, isAdmin, isManager } = useAuth();
  const qc = useQueryClient();

  if (!loading && user && !isSuperAdmin && (isAdmin || isManager)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <BackButton />
        <h1 className="mt-4 font-display text-3xl">Sección de juego</h1>
        <p className="mt-2 text-muted-foreground">
          Las cuentas de administración no tienen plantilla, sobres ni misiones. Tu trabajo es
          registrar el desempeño de los jugadores/as.
        </p>
        <Link
          to="/admin/desempeno"
          className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Ir a Desempeño
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-center text-muted-foreground">Cargando…</div>;
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <BackButton />
        <h1 className="mt-4 font-display text-3xl">Plantilla</h1>
        <p className="mt-2 text-muted-foreground">Inicia sesión para gestionar tu plantilla.</p>
        <Link to="/auth" className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Entrar</Link>
      </div>
    );
  }

  return <Inner userId={user.id} onInvalidate={() => qc.invalidateQueries()} />;
}

function Inner({ userId, onInvalidate }: { userId: string; onInvalidate: () => void }) {
  const qc = useQueryClient();

  // Ensure wallet exists (idempotent client attempt; if RLS blocks INSERT it's fine — trigger handles new users)
  useEffect(() => {
    supabase.from("user_wallet").select("sobres").eq("user_id", userId).maybeSingle();
  }, [userId]);

  const wallet = useQuery({
    queryKey: ["wallet", userId],
    queryFn: async (): Promise<WalletRow> => {
      const { data } = await supabase.from("user_wallet").select("sobres").eq("user_id", userId).maybeSingle();
      return { sobres: data?.sobres ?? 0 };
    },
  });

  const inventory = useQuery({
    queryKey: ["inventory", userId],
    queryFn: async (): Promise<UserPlayerRow[]> => {
      const { data, error } = await supabase
        .from("user_players")
        .select("player_id, player_pool(id, nombre, posicion, rating, team_id)")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as unknown as UserPlayerRow[];
    },
  });

  const usage = useQuery({
    queryKey: ["usage", userId],
    queryFn: async (): Promise<UsageRow[]> => {
      const { data, error } = await supabase.from("player_usage").select("player_id, usos_gastados").eq("user_id", userId);
      if (error) throw error;
      return data ?? [];
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
        .from("lineups")
        .select("*")
        .eq("user_id", userId)
        .eq("jornada_id", jornada.data!.id)
        .maybeSingle();
      return data as LineupRow | null;
    },
  });

  const misiones = useQuery({
    queryKey: ["misiones", userId],
    queryFn: async (): Promise<{ mision: MisionRow; claimed: boolean }[]> => {
      const [{ data: ms }, { data: um }] = await Promise.all([
        supabase.from("misiones").select("id, nombre, descripcion, recompensa_sobres").eq("is_active", true).order("created_at"),
        supabase.from("user_misiones").select("mision_id").eq("user_id", userId),
      ]);
      const claimedIds = new Set((um ?? []).map((r) => r.mision_id));
      return (ms ?? []).map((m) => ({ mision: m as MisionRow, claimed: claimedIds.has(m.id) }));
    },
  });

  const usageMap = useMemo(() => {
    const m = new Map<string, number>();
    (usage.data ?? []).forEach((u) => m.set(u.player_id, u.usos_gastados));
    return m;
  }, [usage.data]);

  const [slotDraft, setSlotDraft] = useState<Record<Posicion, string | null>>({
    portero: null, extremo_izq: null, extremo_der: null,
    lateral_izq: null, lateral_der: null, central: null, pivote: null,
  });
  const [dirty, setDirty] = useState(false);
  const [pickSlot, setPickSlot] = useState<Posicion | null>(null);
  const [sobreResult, setSobreResult] = useState<Array<{ player_id: string; nombre: string; posicion: Posicion; rating: number }> | null>(null);

  // Load persisted lineup into local draft
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
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("open_sobre");
      if (error) throw error;
      const rows = (data ?? []) as Array<{ p_id: string; p_nombre: string; p_posicion: Posicion; p_rating: number }>;
      return rows.map((r) => ({ player_id: r.p_id, nombre: r.p_nombre, posicion: r.p_posicion, rating: r.p_rating }));
    },
    onSuccess: (data) => {
      setSobreResult(data);
      qc.invalidateQueries({ queryKey: ["wallet", userId] });
      qc.invalidateQueries({ queryKey: ["inventory", userId] });
      toast.success(`Sobre abierto: ${data.length} jugadores nuevos`);
    },
    onError: (e: Error) => toast.error(e.message ?? "No se pudo abrir el sobre"),
  });

  const claimMut = useMutation({
    mutationFn: async (misionId: string) => {
      const { data, error } = await supabase.rpc("claim_mision", { _mision_id: misionId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (saldo) => {
      toast.success(`¡Recompensa reclamada! Sobres: ${saldo}`);
      qc.invalidateQueries({ queryKey: ["wallet", userId] });
      qc.invalidateQueries({ queryKey: ["misiones", userId] });
    },
    onError: (e: Error) => toast.error(e.message ?? "No se pudo reclamar"),
  });

  const saveLineupMut = useMutation({
    mutationFn: async () => {
      if (!jornada.data) throw new Error("No hay jornada activa");
      const payload = {
        user_id: userId,
        jornada_id: jornada.data.id,
        ...slotDraft,
      };
      const { error } = await supabase.from("lineups").upsert(payload, { onConflict: "user_id,jornada_id" });
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

  const eligibleForSlot = (slot: Posicion) => {
    return (inventory.data ?? []).filter((up) => {
      const p = up.player_pool;
      if (!p) return false;
      if (p.posicion !== slot) return false;
      const used = usageMap.get(p.id) ?? 0;
      if (used >= MAX_USOS) return false;
      if (alignedIds.has(p.id) && slotDraft[slot] !== p.id) return false;
      return true;
    });
  };

  const playerById = (id: string | null | undefined) => {
    if (!id) return null;
    return (inventory.data ?? []).find((u) => u.player_id === id)?.player_pool ?? null;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <BackButton />

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-none">Mi Plantilla</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
            {jornada.data ? `${jornada.data.nombre} · ${jornada.data.is_locked ? "bloqueada" : "activa"}` : "Sin jornada activa"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
            <span className="text-muted-foreground">Sobres: </span>
            <span className="font-bold text-lg">{wallet.data?.sobres ?? 0}</span>
          </div>
          <button
            onClick={() => openSobreMut.mutate()}
            disabled={openSobreMut.isPending || (wallet.data?.sobres ?? 0) <= 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-40"
          >
            <Package className="h-4 w-4" />
            Abrir sobre
          </button>
        </div>
      </header>

      {/* Court */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-display text-lg">Pista</h2>
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
            const p = playerById(slotDraft[slot]);
            const { x, y } = SLOT_XY[slot];
            return (
              <button
                key={slot}
                type="button"
                onClick={() => !locked && setPickSlot(slot)}
                disabled={locked}
                className="absolute -translate-x-1/2 -translate-y-1/2 group"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div className={`flex flex-col items-center gap-1 ${locked ? "opacity-90" : "hover:scale-105 transition"}`}>
                  <div className={`grid h-14 w-14 place-items-center rounded-full border-2 ${p ? "border-primary bg-primary text-primary-foreground" : "border-dashed border-white/70 bg-black/30 text-white"} shadow-lg font-display text-sm`}>
                    {p ? p.rating : POS_SHORT[slot]}
                  </div>
                  <div className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white max-w-[90px] truncate">
                    {p ? p.nombre : POS_LABEL[slot]}
                  </div>
                </div>
              </button>
            );
          })}
        </Court>
      </section>

      {/* Inventory */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg mb-3">Mis jugadores ({inventory.data?.length ?? 0})</h2>
        {(inventory.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no tienes jugadores. Abre un sobre para conseguir los primeros.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(inventory.data ?? []).map((up) => {
              const p = up.player_pool;
              if (!p) return null;
              const used = usageMap.get(p.id) ?? 0;
              const restantes = MAX_USOS - used;
              const enPista = alignedIds.has(p.id);
              return (
                <li key={p.id} className={`rounded-lg border p-2 text-xs ${enPista ? "border-primary bg-primary/5" : "border-border bg-background"}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold truncate">{p.nombre}</div>
                    <div className="text-[10px] font-bold text-primary">{p.rating}</div>
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{POS_LABEL[p.posicion]}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className={`text-[10px] font-semibold ${restantes <= 1 ? "text-destructive" : "text-muted-foreground"}`}>
                      Usos {restantes}/{MAX_USOS}
                    </div>
                    {enPista && <span className="text-[10px] font-bold text-primary">EN PISTA</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Misiones */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg mb-3 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[color:var(--gold,#d4a017)]" /> Misiones
        </h2>
        <ul className="space-y-2">
          {(misiones.data ?? []).map(({ mision, claimed }) => (
            <li key={mision.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{mision.nombre}</div>
                <div className="text-xs text-muted-foreground">{mision.descripcion}</div>
              </div>
              <button
                onClick={() => claimMut.mutate(mision.id)}
                disabled={claimed || claimMut.isPending}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold disabled:opacity-40"
              >
                {claimed ? "Reclamada" : (<><Sparkles className="h-3 w-3" /> +{mision.recompensa_sobres}</>)}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Sobre result dialog */}
      <Dialog open={!!sobreResult} onOpenChange={(o) => !o && setSobreResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">¡Nuevo sobre!</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {(sobreResult ?? []).map((p) => (
              <div key={p.player_id} className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-center">
                <div className="text-3xl font-display text-primary">{p.rating}</div>
                <div className="text-xs font-semibold truncate">{p.nombre}</div>
                <div className="text-[10px] uppercase text-muted-foreground">{POS_LABEL[p.posicion]}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Slot picker */}
      <Dialog open={!!pickSlot} onOpenChange={(o) => !o && setPickSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elegir {pickSlot ? POS_LABEL[pickSlot] : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {pickSlot && slotDraft[pickSlot] && (
              <button
                onClick={() => { setSlotDraft((d) => ({ ...d, [pickSlot!]: null })); setDirty(true); setPickSlot(null); }}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs font-semibold text-destructive"
              >
                <X className="h-3 w-3" /> Quitar del hueco
              </button>
            )}
            {pickSlot && eligibleForSlot(pickSlot).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No tienes jugadores disponibles para este hueco. Abre un sobre.
              </p>
            )}
            {pickSlot && eligibleForSlot(pickSlot).map((up) => {
              const p = up.player_pool!;
              const restantes = MAX_USOS - (usageMap.get(p.id) ?? 0);
              return (
                <button
                  key={p.id}
                  onClick={() => { setSlotDraft((d) => ({ ...d, [pickSlot!]: p.id })); setDirty(true); setPickSlot(null); }}
                  className="w-full flex items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-secondary"
                >
                  <div>
                    <div className="font-semibold">{p.nombre}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{POS_LABEL[p.posicion]}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg text-primary">{p.rating}</div>
                    <div className="text-[10px] text-muted-foreground">Usos {restantes}/{MAX_USOS}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Court({ children }: { children: React.ReactNode }) {
  // Half-court in green with basic markings
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
        {/* sideline */}
        <rect x="3" y="3" width="94" height="119" fill="none" stroke="white" strokeWidth="0.5" opacity="0.85" />
        {/* 9m dashed */}
        <path d="M 15 100 Q 50 60 85 100" fill="none" stroke="white" strokeWidth="0.4" strokeDasharray="1.5,1.5" opacity="0.9" />
        {/* 6m solid */}
        <path d="M 25 108 Q 50 78 75 108" fill="none" stroke="white" strokeWidth="0.5" opacity="0.95" />
        {/* goal area */}
        <line x1="35" y1="118" x2="65" y2="118" stroke="white" strokeWidth="0.6" opacity="0.95" />
        {/* 7m line */}
        <line x1="46" y1="95" x2="54" y2="95" stroke="white" strokeWidth="0.4" opacity="0.9" />
      </svg>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
