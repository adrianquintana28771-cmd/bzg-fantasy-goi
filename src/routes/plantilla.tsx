import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Sparkles, X, Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import campoAsset from "@/assets/campo-bzg.png.asset.json";
import escudoAsset from "@/assets/escudo-bzg.png.asset.json";
import sobreAperturaAsset from "@/assets/sobre-apertura.webp.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT, useTd } from "@/lib/i18n";

type Posicion = Database["public"]["Enums"]["plantilla_posicion"];
type Rareza = "normal" | "raro" | "legendario";

const MAX_USOS = 3;

const RAREZA_MULT: Record<Rareza, number> = { normal: 1, raro: 1.3, legendario: 1.5 };
const RAREZA_LABEL_ES: Record<Rareza, string> = { normal: "Normal", raro: "Raro", legendario: "Legendario" };
const RAREZA_LABEL_EU: Record<Rareza, string> = {
  normal: "Normala",
  raro: "Bitxia",
  legendario: "Legendarioa",
};
const RAREZA_STYLE: Record<Rareza, string> = {
  normal: "border-border bg-background",
  raro: "border-sky-500/60 bg-sky-500/10",
  legendario: "border-[color:var(--gold,#d4a017)] bg-[color:var(--gold,#d4a017)]/15",
};

/** Puntuación final de la carta: máximo 2 dígitos */
function cartaPuntos(rating: number, rareza: Rareza) {
  return Math.min(99, Math.round(rating * RAREZA_MULT[rareza]));
}

const fmtPts = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const fmtMult = (m: number) => `×${String(m).replace(".", ",")}`;

/** Muestra base de la jornada · multiplicador de rareza → total final (solo visual) */
function PuntosRareza({
  base,
  rareza,
  className = "",
  baseClass = "text-muted-foreground",
  finalClass = "text-primary",
}: {
  base: number;
  rareza: Rareza;
  className?: string;
  baseClass?: string;
  finalClass?: string;
}) {
  const mult = RAREZA_MULT[rareza];
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 tabular-nums ${className}`}>
      <span className={baseClass}>{fmtPts(base)}</span>
      <span className={`${baseClass} opacity-60`}>·</span>
      <span className={baseClass}>{fmtMult(mult)}</span>
      <span className={`${baseClass} opacity-60`}>→</span>
      <span className={finalClass}>{fmtPts(base * mult)} pts</span>
    </span>
  );
}

const POS_LABEL: Record<Posicion, string> = {
  portero: "Atezaina",
  extremo_izq: "Hegaleko ezk.",
  extremo_der: "Hegaleko esk.",
  lateral_izq: "Atzelari ezk.",
  lateral_der: "Atzelari esk.",
  central: "Erdikoa",
  pivote: "Pibota",
  entrenador: "Entrenatzailea",
};

const POS_SHORT: Record<Posicion, string> = {
  portero: "PT",
  extremo_izq: "EI",
  extremo_der: "ED",
  lateral_izq: "LI",
  lateral_der: "LD",
  central: "C",
  pivote: "P",
  entrenador: "ENT",
};

const SLOTS: Posicion[] = [
  "portero",
  "extremo_izq",
  "extremo_der",
  "lateral_izq",
  "lateral_der",
  "central",
  "pivote",
  "entrenador",
];

const SLOT_XY: Record<Posicion, { x: number; y: number }> = {
  portero: { x: 50, y: 88 },
  extremo_izq: { x: 90, y: 58 },
  extremo_der: { x: 10, y: 58 },
  lateral_izq: { x: 86, y: 30 },
  lateral_der: { x: 14, y: 30 },
  central: { x: 50, y: 22 },
  pivote: { x: 50, y: 52 },
  entrenador: { x: 14, y: 90 },
};

export const Route = createFileRoute("/plantilla")({
  head: () => ({
    meta: [
      { title: "Mi equipo · BZG Fantasy" },
      {
        name: "description",
        content: "Alinea a tus jugadores en el medio campo y gestiona tus cartas de BZG Fantasy.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlantillaPage,
});

interface PoolRow {
  id: string;
  nombre: string;
  posicion: Posicion;
  rating: number;
  rareza: Rareza;
  team_id?: string | null;
  estado?: "disponible" | "dudoso" | "no_disponible";
  club_teams?: { nombre: string } | null;
}

/** Foto de la carta: mismo origen para sobres, selector y campo */
function CardPhoto({ className = "" }: { className?: string }) {
  return <img src={escudoAsset.url} alt="" aria-hidden="true" className={`object-contain ${className}`} />;
}
interface CopyRow {
  id: string;
  player_id: string;
  usos: number;
  player_pool: PoolRow | null;
}
interface JornadaRow {
  id: string;
  numero: number;
  nombre: string;
  is_active: boolean;
  is_locked: boolean;
}
interface LineupRow {
  id: string;
  jornada_id: string;
  locked: boolean;
  portero: string | null;
  extremo_izq: string | null;
  extremo_der: string | null;
  lateral_izq: string | null;
  lateral_der: string | null;
  central: string | null;
  pivote: string | null;
  entrenador: string | null;
}

function PlantillaPage() {
  const { user, loading, isStaff } = useAuth();

  const t = useT();
  const td = useTd();
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center text-muted-foreground">
        {t("Kargatzen…", "Cargando…")}
      </div>
    );
  }

  if (user && isStaff) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <BackButton />
        <h1 className="mt-4 font-display text-3xl">{t("Jokoaren atala", "Sección de juego")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t(
            "Administrazio kontuek ez dute talderik, gutunazalik edo misiorik. Zure lana jokalarien errendimendua erregistratzea da.",
            "Las cuentas de administración no tienen equipo, sobres ni misiones. Tu trabajo es registrar el desempeño de los jugadores/as.",
          )}
        </p>
        <Link
          to="/admin/desempeno"
          className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t("Joan Errendimendura", "Ir a Desempeño")}
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <BackButton />
        <h1 className="mt-4 font-display text-3xl">{t("Nire taldea", "Mi equipo")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t(
            "Hasi saioa zure taldea sortzeko eta zure jokalariak lerrokatzeko.",
            "Inicia sesión para crear tu equipo y alinear a tus jugadores.",
          )}
        </p>
        <Link
          to="/auth"
          className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t("Sartu", "Entrar")}
        </Link>
      </div>
    );
  }

  return <Inner userId={user.id} />;
}

function Inner({ userId }: { userId: string }) {
  const t = useT();
  const td = useTd();
  const qc = useQueryClient();

  const wallet = useQuery({
    queryKey: ["wallet", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_wallet")
        .select("sobres, sobres_premium")
        .eq("user_id", userId)
        .maybeSingle();
      return {
        sobres: data?.sobres ?? 0,
        premium: (data as { sobres_premium?: number } | null)?.sobres_premium ?? 0,
      };
    },
  });

  const inventory = useQuery({
    queryKey: ["inventory", userId],
    queryFn: async (): Promise<CopyRow[]> => {
      const { data, error } = await supabase
        .from("user_players")
        .select("id, player_id, usos, player_pool(id, nombre, posicion, rating, rareza, team_id, estado)")
        .eq("user_id", userId);
      if (error) throw error;
      const { data: teams } = await supabase.from("club_teams").select("id, nombre");
      const tmap = new Map((teams ?? []).map((t) => [t.id, t.nombre]));
      return ((data ?? []) as unknown as CopyRow[]).map((c) =>
        c.player_pool
          ? {
              ...c,
              player_pool: {
                ...c.player_pool,
                club_teams: c.player_pool.team_id
                  ? { nombre: tmap.get(c.player_pool.team_id) ?? "" }
                  : null,
              },
            }
          : c,
      );
    },
  });

  /** Posiciones en las que puede jugar cada jugador (N:M) */
  const positions = useQuery({
    queryKey: ["pool-positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_pool_positions")
        .select("player_id, posicion");
      if (error) throw error;
      const map = new Map<string, Posicion[]>();
      (data ?? []).forEach((r) => {
        const arr = map.get(r.player_id) ?? [];
        arr.push(r.posicion as Posicion);
        map.set(r.player_id, arr);
      });
      return map;
    },
  });

  const jornada = useQuery({
    queryKey: ["jornada-activa"],
    queryFn: async (): Promise<JornadaRow | null> => {
      const { data } = await supabase
        .from("jornadas")
        .select("*")
        .eq("is_active", true)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();
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

  /** Puntos reales de cada jugador en la jornada activa (player_jornada_stats) */
  const jornadaPts = useQuery({
    queryKey: ["jornada-pts", jornada.data?.numero],
    enabled: !!jornada.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_jornada_stats")
        .select("player_id, puntos")
        .eq("jornada_numero", jornada.data!.numero);
      if (error) throw error;
      const map = new Map<string, number>();
      (data ?? []).forEach((s) =>
        map.set(s.player_id, (map.get(s.player_id) ?? 0) + Number(s.puntos)),
      );
      return map;
    },
  });

  const ptsJornada = (id: string) => jornadaPts.data?.get(id) ?? 0;


  const historial = useQuery({
    queryKey: ["historial-jornadas", userId],
    queryFn: async () => {
      const [{ data: lineups }, { data: stats }, { data: pool }] = await Promise.all([
        supabase.from("lineups").select("*, jornadas(numero, nombre)").eq("user_id", userId),
        supabase.from("player_jornada_stats").select("player_id, jornada_numero, puntos"),
        supabase.from("player_pool").select("id, nombre, rareza"),
      ]);
      const nameById = new Map((pool ?? []).map((p) => [p.id, p.nombre]));
      const rarezaById = new Map((pool ?? []).map((p) => [p.id, p.rareza as Rareza]));
      const ptsKey = new Map(
        (stats ?? []).map((s) => [`${s.player_id}|${s.jornada_numero}`, Number(s.puntos)]),
      );
      return (
        (lineups ?? []) as unknown as Array<
          LineupRow & { jornadas: { numero: number; nombre: string } | null }
        >
      )
        .filter((l) => !!l.jornadas)
        .map((l) => {
          const numero = l.jornadas!.numero;
          const alineados = SLOTS.map((slot) => {
            const pid = l[slot];
            return pid
              ? {
                  slot,
                  id: pid,
                  nombre: nameById.get(pid) ?? pid,
                  rareza: rarezaById.get(pid) ?? ("normal" as Rareza),
                  base: ptsKey.get(`${pid}|${numero}`) ?? 0,
                  puntos:
                    Math.round(
                      (ptsKey.get(`${pid}|${numero}`) ?? 0) *
                        RAREZA_MULT[rarezaById.get(pid) ?? "normal"] *
                        100,
                    ) / 100,
                }
              : null;
          }).filter(Boolean) as Array<{
            slot: Posicion;
            id: string;
            nombre: string;
            rareza: Rareza;
            base: number;
            puntos: number;
          }>;
          return {
            jornadaId: l.jornada_id,
            numero,
            nombre: l.jornadas!.nombre,
            alineados,
            total: Math.round(alineados.reduce((a, p) => a + p.puntos, 0)),
          };
        })
        .sort((a, b) => b.numero - a.numero);
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
    return [...map.values()]
      .map(({ pool, copias }) => {
        const disponibles = copias.filter((c) => c.usos < MAX_USOS).sort((a, b) => b.usos - a.usos);
        const activa = disponibles[0];
        return {
          pool,
          total: copias.length,
          disponibles: disponibles.length,
          usosRestantes: activa ? MAX_USOS - activa.usos : 0,
          usable: !!activa,
        };
      })
      .sort(
        (a, b) =>
          cartaPuntos(b.pool.rating, b.pool.rareza) - cartaPuntos(a.pool.rating, a.pool.rareza),
      );
  }, [inventory.data]);

  const [slotDraft, setSlotDraft] = useState<Record<Posicion, string | null>>({
    portero: null,
    extremo_izq: null,
    extremo_der: null,
    lateral_izq: null,
    lateral_der: null,
    central: null,
    pivote: null,
    entrenador: null,
  });
  const [dirty, setDirty] = useState(false);
  const [pickSlot, setPickSlot] = useState<Posicion | null>(null);
  const [sobreResult, setSobreResult] = useState<Array<{
    id: string;
    nombre: string;
    posicion: Posicion;
    rating: number;
    rareza: Rareza;
  }> | null>(null);
  const [sobreRevelado, setSobreRevelado] = useState(false);

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
        entrenador: lineup.data.entrenador,
      });
      setDirty(false);
    }
  }, [lineup.data]);

  useEffect(() => {
    if (!sobreResult) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setSobreRevelado(true);
      return;
    }

    setSobreRevelado(false);
    const revealTimer = window.setTimeout(() => setSobreRevelado(true), 2100);
    return () => window.clearTimeout(revealTimer);
  }, [sobreResult]);

  const openSobreMut = useMutation({
    mutationFn: async (tipo: "normal" | "premium") => {
      const { data, error } = await (
        supabase.rpc as unknown as (
          f: string,
          a: Record<string, unknown>,
        ) => Promise<{
          data: Array<{
            p_id: string;
            p_nombre: string;
            p_posicion: Posicion;
            p_rating: number;
            p_rareza: Rareza;
          }> | null;
          error: { message: string } | null;
        }>
      )("open_sobre", { _tipo: tipo });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        id: r.p_id,
        nombre: r.p_nombre,
        posicion: r.p_posicion,
        rating: r.p_rating,
        rareza: r.p_rareza,
      }));
    },
    onSuccess: (data, tipo) => {
      qc.setQueryData<{ sobres: number; premium: number }>(["wallet", userId], (w) =>
        w
          ? tipo === "premium"
            ? { ...w, premium: Math.max(0, w.premium - 1) }
            : { ...w, sobres: Math.max(0, w.sobres - 1) }
          : w,
      );
      setSobreResult(data);
      qc.invalidateQueries({ queryKey: ["wallet", userId] });
      void qc.refetchQueries({ queryKey: ["inventory", userId] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("premium")
          ? t("Ez duzu gutunazal premiumik", "No tienes sobres premium")
          : t("Ez duzu gutunazalik eskuragarri", "No tienes sobres disponibles"),
      ),
  });

  const saveLineupMut = useMutation({
    mutationFn: async () => {
      if (!jornada.data)
        throw new Error(t("Ez dago jardunaldi aktiborik", "No hay jornada activa"));
      const { error } = await supabase
        .from("lineups")
        .upsert(
          { user_id: userId, jornada_id: jornada.data.id, ...slotDraft },
          { onConflict: "user_id,jornada_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Alineazioa gorde da", "Alineación guardada"));
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["lineup", userId] });
      qc.invalidateQueries({ queryKey: ["historial-jornadas", userId] });
    },
    onError: (e: Error) => toast.error(e.message ?? t("Ezin izan da gorde", "No se pudo guardar")),
  });

  const alignedIds = new Set(Object.values(slotDraft).filter(Boolean) as string[]);
  const locked = !!lineup.data?.locked || !!jornada.data?.is_locked;

  const cardById = (id: string | null | undefined) =>
    id ? (cards.find((c) => c.pool.id === id) ?? null) : null;

  /** Todas las posiciones en las que puede jugar (mínimo la principal) */
  const posList = (id: string, principal: Posicion): Posicion[] => {
    const list = positions.data?.get(id);
    return list && list.length ? list : [principal];
  };

  const eligibleForSlot = (slot: Posicion) =>
    cards.filter(
      (c) =>
        posList(c.pool.id, c.pool.posicion).includes(slot) &&
        c.usable &&
        (!alignedIds.has(c.pool.id) || slotDraft[slot] === c.pool.id),
    );

  /** Puntuación estimada de la jornada (sin límite de visualización) */
  const puntosJornada = Math.round(
    (Object.values(slotDraft).filter(Boolean) as string[]).reduce(
      (acc, id) =>
        acc +
        (cardById(id) ? cartaPuntos(cardById(id)!.pool.rating, cardById(id)!.pool.rareza) : 0),
      0,
    ) / 8,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <BackButton />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-none">{t("Nire taldea", "Mi equipo")}</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            {jornada.data
              ? `${td(jornada.data.nombre)} · ${jornada.data.is_locked ? t("blokeatuta", "bloqueada") : t("aktiboa", "activa")}`
              : t("Jardunaldi aktiborik ez", "Sin jornada activa")}
          </p>
        </div>
        <div className="rounded-xl bg-primary/10 px-4 py-2 text-center">
          <div className="font-display text-2xl text-primary">{puntosJornada}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("jardunaldiko ptak", "pts jornada")}
          </div>
        </div>
      </header>

      {/* Sobres */}
      <section className="grid grid-cols-2 gap-3">
        <button
          onClick={() => openSobreMut.mutate("normal")}
          disabled={openSobreMut.isPending || (wallet.data?.sobres ?? 0) <= 0}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm font-semibold disabled:opacity-40"
        >
          <Package className="h-5 w-5 text-primary" /> {t("Gutunazal normala", "Sobre normal")} (
          {wallet.data?.sobres ?? 0})
        </button>
        <button
          onClick={() => openSobreMut.mutate("premium")}
          disabled={openSobreMut.isPending || (wallet.data?.premium ?? 0) <= 0}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[color:var(--gold,#d4a017)] bg-card p-3 text-sm font-bold disabled:opacity-40"
        >
          <Sparkles className="h-5 w-5 text-[color:var(--gold,#d4a017)]" />{" "}
          {t("Premiuma", "Premium")} ({wallet.data?.premium ?? 0})
        </button>
      </section>

      {/* Medio campo */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-lg">
            {t("Jardunaldiko alineazioa", "Alineación de la jornada")}
          </h2>
          {locked ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> {t("Blokeatuta", "Bloqueada")}
            </span>
          ) : (
            <button
              onClick={() => saveLineupMut.mutate()}
              disabled={!dirty || saveLineupMut.isPending || !jornada.data}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--gold,#d4a017)] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" /> {t("Gorde", "Guardar")}
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
                <div
                  className={`flex flex-col items-center gap-1 ${locked ? "opacity-90" : "transition hover:scale-105"}`}
                >
                  <div
                    className={`grid h-14 w-14 place-items-center rounded-full border-2 font-display text-sm shadow-lg ${
                      c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-dashed border-white/70 bg-black/30 text-white"
                    }`}
                  >
                    {c ? (
                      <div className="relative h-full w-full overflow-hidden rounded-full">
                        <CardPhoto className="h-full w-full bg-background p-1" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[10px] leading-tight text-white">
                          {cartaPuntos(c.pool.rating, c.pool.rareza)}
                        </span>
                      </div>
                    ) : (
                      POS_SHORT[slot]
                    )}
                  </div>
                  <div translate="no" className="max-w-[90px] truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {c ? c.pool.nombre : POS_LABEL[slot]}
                  </div>
                  {c && (
                    <div className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold">
                      <PuntosRareza
                        base={ptsJornada(c.pool.id)}
                        rareza={c.pool.rareza}
                        baseClass="text-white/70"
                        finalClass="text-white"
                      />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </Court>
      </section>

      {/* Historial de jornadas */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-lg">
          {t("Aurreko jardunaldiak", "Jornadas anteriores")}
        </h2>
        {(historial.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(
              "Oraindik ez duzu jardunaldirik lerrokatu.",
              "Todavía no has alineado ninguna jornada.",
            )}
          </p>
        ) : (
          <div className="space-y-3">
            {(historial.data ?? []).map((h) => (
              <div key={h.jornadaId} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{td(h.nombre)}</div>
                  <div className="text-right">
                    <div className="font-display text-2xl text-primary">{h.total}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      pts
                    </div>
                  </div>
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {h.alineados.map((p) => (
                    <li
                      key={p.slot}
                      className="flex items-center justify-between gap-1 rounded-md bg-secondary px-2 py-1 text-[11px]"
                    >
                      <span className="truncate">
                        <span className="font-bold">{POS_SHORT[p.slot]}</span> <span translate="no">{p.nombre}</span>
                      </span>
                      <PuntosRareza
                        base={p.base}
                        rareza={p.rareza}
                        className="shrink-0 text-[10px]"
                        finalClass={p.puntos < 0 ? "text-destructive" : "text-foreground"}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mis jugadores */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-lg">
          {t("Nire jokalariak", "Mis jugadores")} ({cards.length})
        </h2>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("Oraindik ez duzu jokalaririk. Osatu", "Todavía no tienes jugadores. Completa")}{" "}
            <Link to="/misiones" search={{ qr: undefined }} className="text-primary underline">
              {t("misioak", "misiones")}
            </Link>{" "}
            {t("gutunazalak lortzeko.", "para conseguir sobres.")}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cards.map((c) => {
              const enPista = alignedIds.has(c.pool.id);
              return (
                <li
                  key={c.pool.id}
                  className={`rounded-lg border-2 p-2 text-xs ${enPista ? "border-primary bg-primary/5" : RAREZA_STYLE[c.pool.rareza]}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div translate="no" className="truncate font-semibold">{c.pool.nombre}</div>
                    <div className="font-display text-base text-primary">
                      {cartaPuntos(c.pool.rating, c.pool.rareza)}
                    </div>
                  </div>
                  <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                    {posList(c.pool.id, c.pool.posicion)
                      .map((p) => POS_SHORT[p])
                      .join(" · ")}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase">
                      {t(RAREZA_LABEL_EU[c.pool.rareza], RAREZA_LABEL_ES[c.pool.rareza])} {fmtMult(RAREZA_MULT[c.pool.rareza])}
                    </span>
                    {c.total > 1 && (
                      <span className="rounded bg-secondary px-1 text-[10px] font-bold">
                        x{c.total}
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-[10px] font-semibold ${c.usosRestantes <= 1 ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {t("Erabilerak", "Usos")} {c.usosRestantes}/{MAX_USOS}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1 text-[10px] font-semibold">
                    <span className="text-muted-foreground">
                      {t("Jardunaldia", "Jornada")}:
                    </span>
                    <PuntosRareza base={ptsJornada(c.pool.id)} rareza={c.pool.rareza} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Resultado del sobre */}
      <Dialog
        open={!!sobreResult}
        onOpenChange={(open) => {
          if (!open) {
            setSobreResult(null);
            setSobreRevelado(false);
          }
        }}
      >
        <DialogContent
          className={
            sobreRevelado
              ? "max-w-lg"
              : "w-[min(94vw,52rem)] max-w-none border-0 bg-transparent p-0 shadow-none [&>button]:text-primary-foreground"
          }
        >
          {sobreRevelado ? (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">
                  {t("Gutunazal berria!", "¡Nuevo sobre!")}
                </DialogTitle>
              </DialogHeader>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(sobreResult ?? []).map((p, i) => (
                  <div
                    key={`${p.id}-${i}`}
                    className={`rounded-lg border-2 p-3 text-center ${RAREZA_STYLE[p.rareza]}`}
                  >
                    <div className="relative mb-1">
                      <CardPhoto className="mx-auto h-16 w-full" />
                      {cardById(p.id)?.pool.club_teams?.nombre && (
                        <div className="absolute inset-x-0 top-0 truncate rounded bg-black/60 px-1 text-[9px] font-semibold text-white">
                          {cardById(p.id)!.pool.club_teams!.nombre}
                        </div>
                      )}
                    </div>
                    <div className="font-display text-3xl text-primary">
                      {cartaPuntos(p.rating, p.rareza)}
                    </div>
                    <div translate="no" className="truncate text-xs font-semibold">{p.nombre}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">
                      {t(RAREZA_LABEL_EU[p.rareza], RAREZA_LABEL_ES[p.rareza])}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <DialogTitle className="sr-only">
                {t("Gutunazala irekitzen", "Abriendo sobre")}
              </DialogTitle>
              <img
                src={sobreAperturaAsset.url}
                alt=""
                aria-hidden="true"
                className="mx-auto aspect-[26/19] w-full max-w-[52rem] object-contain"
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Elegir jugador para un hueco */}
      <Dialog open={!!pickSlot} onOpenChange={(o) => !o && setPickSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("Aukeratu", "Elegir")} {pickSlot ? POS_LABEL[pickSlot] : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {pickSlot && slotDraft[pickSlot] && (
              <button
                onClick={() => {
                  setSlotDraft((d) => ({ ...d, [pickSlot!]: null }));
                  setDirty(true);
                  setPickSlot(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs font-semibold text-destructive"
              >
                <X className="h-3 w-3" /> {t("Kendu hutsunetik", "Quitar del hueco")}
              </button>
            )}
            {pickSlot && eligibleForSlot(pickSlot).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t(
                  "Ez duzu jokalaririk hutsune honetarako. Ireki gutunazal bat.",
                  "No tienes jugadores para este hueco. Abre un sobre.",
                )}
              </p>
            )}
            {pickSlot &&
              eligibleForSlot(pickSlot).map((c) => (
                <button
                  key={c.pool.id}
                  onClick={() => {
                    setSlotDraft((d) => ({ ...d, [pickSlot!]: c.pool.id }));
                    setDirty(true);
                    setPickSlot(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg border-2 p-3 text-left ${RAREZA_STYLE[c.pool.rareza]}`}
                >
                  <CardPhoto className="mr-3 h-10 w-10 shrink-0 rounded-full bg-background p-0.5" />
                  <div className="min-w-0 flex-1">
                    <div translate="no" className="font-semibold">
                      {c.pool.nombre}
                      {c.pool.club_teams?.nombre ? ` — ${c.pool.club_teams.nombre}` : ""}
                      {c.pool.estado && c.pool.estado !== "disponible" && (
                        <span className={c.pool.estado === "dudoso" ? "text-warning" : "text-destructive"}>
                          {" — "}
                          {c.pool.estado === "dudoso"
                            ? t("Zalantzazkoa", "Dudoso")
                            : t("Ez eskuragarri", "No disponible")}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground">
                      {posList(c.pool.id, c.pool.posicion)
                        .map((p) => POS_SHORT[p])
                        .join(" · ")}{" "}
                      · {t(RAREZA_LABEL_EU[c.pool.rareza], RAREZA_LABEL_ES[c.pool.rareza])}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg text-primary">
                      {cartaPuntos(c.pool.rating, c.pool.rareza)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {t("Erabilerak", "Usos")} {c.usosRestantes}/{MAX_USOS}
                    </div>
                    <div className="text-[10px] font-semibold">
                      <PuntosRareza
                        base={ptsJornada(c.pool.id)}
                        rareza={c.pool.rareza}
                        className="justify-end"
                      />
                    </div>
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
      <img
        src={campoAsset.url}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* velo suave para que los huecos se lean bien sobre el campo */}
      <div className="absolute inset-0 bg-black/10" />
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
