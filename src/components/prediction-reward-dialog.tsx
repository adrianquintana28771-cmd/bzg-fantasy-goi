import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import sobreAperturaAsset from "@/assets/animacion_sobre.mp4.asset.json";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EquipoCard, type PoolRow } from "@/components/equipo-card";
import { useCardImages } from "@/lib/card-images";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import { claimPredictionReward, getPendingPredictionReward } from "@/lib/prediction-rewards.functions";

type Phase = "ask" | "video" | "cards" | "none";

/** Pop-up de Inicio: recompensa de predicción pendiente tras cerrar la jornada; se muestra una sola vez. */
export function PredictionRewardDialog() {
  const t = useT();
  const { user } = useAuth();
  const qc = useQueryClient();
  const images = useCardImages();
  const pending = useQuery({
    queryKey: ["pred-reward-pending", user?.id],
    enabled: !!user,
    queryFn: () => getPendingPredictionReward(),
  });
  const [phase, setPhase] = useState<Phase>("ask");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ aciertos: number; cartas: PoolRow[] } | null>(null);
  const [idx, setIdx] = useState(0);

  const p = pending.data;
  const open = !!p && phase !== "none";

  const finish = () => {
    setPhase("none");
    qc.invalidateQueries({ queryKey: ["inventory"] });
    qc.invalidateQueries({ queryKey: ["pred-reward-pending"] });
    setTimeout(() => { setPhase("ask"); setResult(null); setIdx(0); }, 300);
  };

  const claim = async () => {
    if (!p || busy) return;
    setBusy(true);
    try {
      const r = await claimPredictionReward({ data: { jornadaId: p.jornadaId } });
      setResult({ aciertos: r.aciertos, cartas: r.cartas as unknown as PoolRow[] });
      setPhase(r.cartas.length ? "video" : "cards");
    } catch {
      toast.error(t("Ezin izan da saria jaso", "No se pudo recoger la recompensa"));
      finish();
    } finally {
      setBusy(false);
    }
  };

  const card = result?.cartas[idx];
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && phase !== "video" && !busy && result) finish(); }}>
      <DialogContent
        className={phase === "video"
          ? "w-[min(94vw,52rem)] max-w-none border-0 bg-transparent p-0 shadow-none [&>button.absolute]:hidden"
          : "max-h-[90dvh] max-w-sm overflow-y-auto [&>button.absolute]:hidden"}
      >
        {phase === "ask" && p && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{t("Iragarpenaren saria", "Recompensa de predicción")}</DialogTitle>
              <DialogDescription>
                {t(`J${p.numero} jardunaldia itxi da. Jaso zure iragarpenaren saria!`, `La jornada J${p.numero} se ha cerrado. ¡Recoge la recompensa de tu predicción!`)}
              </DialogDescription>
            </DialogHeader>
            <Button onClick={claim} disabled={busy} className="mt-2 w-full">
              {busy ? t("Kargatzen…", "Cargando…") : t("Jaso iragarpenaren saria", "Recoger recompensa de predicción")}
            </Button>
          </>
        )}
        {phase === "video" && (
          <>
            <DialogTitle className="sr-only">{t("Gutunazala irekitzen", "Abriendo sobre")}</DialogTitle>
            <video
              src={sobreAperturaAsset.url}
              autoPlay
              muted
              playsInline
              aria-hidden="true"
              onEnded={() => setPhase("cards")}
              onError={() => setPhase("cards")}
              className="mx-auto aspect-video max-h-[75dvh] w-full max-w-[52rem] object-contain"
            />
          </>
        )}
        {phase === "cards" && result && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                {result.aciertos}/8 {t("asmatuta", "aciertos")}
              </DialogTitle>
            </DialogHeader>
            {card ? (
              <div className="mt-2 flex flex-col items-center gap-3">
                <div aria-live="polite" className="text-sm tabular-nums text-muted-foreground">{idx + 1} / {result.cartas.length}</div>
                <Button
                  key={`${card.id}-${idx}`}
                  variant="ghost"
                  onClick={() => (idx < result.cartas.length - 1 ? setIdx(idx + 1) : finish())}
                  aria-label={idx < result.cartas.length - 1 ? t("Hurrengo fitxa", "Siguiente ficha") : t("Amaitu", "Finalizar")}
                  className="h-auto w-full max-w-[16rem] whitespace-normal p-0 text-left hover:bg-transparent motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                >
                  <EquipoCard pool={card} images={images.data} posiciones={[card.posicion]} usos={1} puntos={0} />
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("Jardunaldi honetan ez duzu asmatu. Animo hurrengorako!", "0 aciertos esta jornada. ¡Ánimo para la próxima!")}
                </p>
                <Button onClick={finish} className="mt-2 w-full">{t("Ados", "Aceptar")}</Button>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
