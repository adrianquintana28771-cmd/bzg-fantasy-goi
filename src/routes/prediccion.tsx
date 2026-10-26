import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import {
  PRED_SLOTS,
  SLOT_LABEL,
  fetchClubCandidates,
  fetchIdealSeven,
  type PredSlot,
} from "@/lib/ideal-seven";

export const Route = createFileRoute("/prediccion")({
  head: () => ({
    meta: [
      { title: "Predicción · BZG Fantasy" },
      { name: "description", content: "Predice los mejores jugadores/as de la jornada en BZG Fantasy." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Predicción · BZG Fantasy" },
      { property: "og:description", content: "Intenta adivinar el 7 ideal de la jornada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrediccionPage,
});

type Picks = Partial<Record<PredSlot, string | null>>;

function PrediccionPage() {
  const t = useT();
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [picks, setPicks] = useState<Picks>({});

  const jornadas = useQuery({
    queryKey: ["pred-jornadas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jornadas").select("id,numero,is_active,is_locked").order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });
  const cands = useQuery({ queryKey: ["pred-candidates"], queryFn: fetchClubCandidates });
  const mine = useQuery({
    queryKey: ["predicciones", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("predicciones").select("*").eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });
  const activa = jornadas.data?.find((j) => j.is_active);
  const actual = mine.data?.find((p) => p.jornada_id === activa?.id);
  useEffect(() => {
    if (actual) setPicks(Object.fromEntries(PRED_SLOTS.map((s) => [s, actual[s]])));
  }, [actual]);

  const lastClosed = [...(jornadas.data ?? [])].reverse().find((j) => j.is_locked && mine.data?.some((p) => p.jornada_id === j.id));
  const pasada = mine.data?.find((p) => p.jornada_id === lastClosed?.id);
  const ideal = useQuery({
    queryKey: ["ideal-seven", lastClosed?.numero],
    enabled: !!lastClosed,
    queryFn: () => fetchIdealSeven(lastClosed!.numero),
  });

  const save = useMutation({
    mutationFn: async () => {
      const row = { user_id: user!.id, jornada_id: activa!.id, ...Object.fromEntries(PRED_SLOTS.map((s) => [s, picks[s] ?? null])) };
      const { error } = await supabase.from("predicciones").upsert(row, { onConflict: "user_id,jornada_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Iragarpena gordeta", "Predicción guardada"));
      qc.invalidateQueries({ queryKey: ["predicciones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return null;
  const locked = !activa || activa.is_locked;
  const usados = new Set(Object.values(picks).filter(Boolean));

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <BackButton />
      <header>
        <h1 className="flex items-center gap-2 font-display text-3xl leading-none">
          <Target className="h-7 w-7 text-primary" /> {t("Iragarpena", "Predicción")}
          {activa && <span className="text-base text-muted-foreground">· J{activa.numero}</span>}
        </h1>
        <p className="mt-3 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          {t(
            "Saiatu jardunaldiko jokalaririk onenak asmatzen. Jokalari batek hainbat posiziotan joka badezake, puntu gehien dituen posizioan zenbatuko da.",
            "Intenta predecir quiénes serán los mejores jugadores de la jornada. Si un jugador puede jugar en varias posiciones, se contará en la posición donde sea el que más puntos tenga.",
          )}
        </p>
      </header>

      {!user ? (
        <p className="text-center text-muted-foreground">
          {t("Hasi saioa iragartzeko.", "Inicia sesión para hacer tu predicción.")}
        </p>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display text-lg">{t("Zure iragarpena", "Tu predicción")}</h2>
            {locked ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> {t("Blokeatuta", "Bloqueada")}
              </span>
            ) : (
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--gold,#d4a017)] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" /> {t("Gorde", "Guardar")}
              </button>
            )}
          </div>
          <PredictionCourt picks={picks} names={names} onPick={setPickSlot} disabled={locked} />
        </section>
      )}

      <Dialog open={!!pickSlot} onOpenChange={(o) => !o && setPickSlot(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("Aukeratu", "Elegir")} {pickSlot ? t(...SLOT_LABEL[pickSlot]) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-1 overflow-auto">
            {pickSlot && picks[pickSlot] && (
              <button
                onClick={() => { setPicks((p) => ({ ...p, [pickSlot]: null })); setPickSlot(null); }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs font-semibold text-destructive"
              >
                <X className="h-3 w-3" /> {t("Kendu hutsunetik", "Quitar del hueco")}
              </button>
            )}
            {pickSlot &&
              (cands.data ?? [])
                .filter((c) => c.activo && c.estado !== "no_disponible")
                .filter((c) => (pickSlot === "entrenador" ? c.esEntrenador : !c.esEntrenador && c.posiciones.includes(pickSlot)))
                .filter((c) => !usados.has(c.id) || picks[pickSlot] === c.id)
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map((c) => (
                  <button
                    key={c.id}
                    translate="no"
                    onClick={() => { setPicks((p) => ({ ...p, [pickSlot]: c.id })); setPickSlot(null); }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${picks[pickSlot] === c.id ? "bg-primary/10 font-semibold" : ""}`}
                  >
                    {c.nombre}
                  </button>
                ))}
          </div>
        </DialogContent>
      </Dialog>
      )}

      {pasada && lastClosed && ideal.data && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-lg">
            J{lastClosed.numero} · {t("Asmatutakoak", "Aciertos")}:{" "}
            {PRED_SLOTS.filter((s) => pasada[s] && ideal.data.ideal[s]?.id === pasada[s]).length}/{PRED_SLOTS.length}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {PRED_SLOTS.map((s) => {
              const ok = !!pasada[s] && ideal.data.ideal[s]?.id === pasada[s];
              return (
                <li key={s} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t(...SLOT_LABEL[s])}</span>
                  <span translate="no" className={ok ? "font-semibold text-primary" : ""}>
                    {ok ? "✅ " : ""}
                    {pasada[s] ? ideal.data.nameById.get(pasada[s]!) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
