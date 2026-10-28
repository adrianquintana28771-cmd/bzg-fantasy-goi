import campoAsset from "@/assets/campo-bzg.png.asset.json";
import { CardPhoto, POS_SHORT, POS_SHORT_EU, type PoolRow } from "@/components/equipo-card";
import { useCardImages } from "@/lib/card-images";
import { PRED_SLOTS, SLOT_LABEL, type PredSlot } from "@/lib/ideal-seven";
import { useT } from "@/lib/i18n";

/** Same slot coordinates as the Equipo court. */
const SLOT_XY: Record<PredSlot, { x: number; y: number }> = {
  portero: { x: 50, y: 84 },
  extremo_izq: { x: 84, y: 56 },
  extremo_der: { x: 16, y: 56 },
  lateral_izq: { x: 80, y: 30 },
  lateral_der: { x: 20, y: 30 },
  central: { x: 50, y: 18 },
  pivote: { x: 50, y: 48 },
  entrenador: { x: 17, y: 84 },
};

export function PredictionCourt({
  picks,
  names,
  points,
  onPick,
  disabled,
}: {
  picks: Partial<Record<PredSlot, string | null>>;
  names: Map<string, string>;
  points?: Partial<Record<PredSlot, string>>;
  onPick?: (slot: PredSlot) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const images = useCardImages();
  return (
    <div className="relative w-full" style={{ aspectRatio: "1 / 1.25" }}>
      <img src={campoAsset.url} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-black/10" />
      {PRED_SLOTS.map((slot) => {
        const id = picks[slot];
        const { x, y } = SLOT_XY[slot];
        return (
          <button
            key={slot}
            type="button"
            disabled={disabled || !onPick}
            onClick={() => onPick?.(slot)}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <div className={`flex flex-col items-center gap-1 ${onPick && !disabled ? "transition hover:scale-105" : ""}`}>
              <div
                className={`grid h-12 w-12 place-items-center overflow-hidden rounded-full border-2 font-display text-sm shadow-lg ${
                  id ? "border-primary bg-primary text-primary-foreground" : "border-dashed border-white/70 bg-black/30 text-white"
                }`}
              >
                {id ? (
                  <CardPhoto
                    images={images.data}
                    pool={{ club_player_id: id, rareza: "normal" } as unknown as PoolRow}
                    name={names.get(id)}
                    className="h-full w-full rounded-full"
                  />
                ) : (
                  t(POS_SHORT_EU[slot], POS_SHORT[slot])
                )}
              </div>
              <div translate={id ? "no" : undefined} className="max-w-[78px] truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {id ? names.get(id) : t(...SLOT_LABEL[slot])}
              </div>
              {points?.[slot] && (
                <div className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">{points[slot]}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
