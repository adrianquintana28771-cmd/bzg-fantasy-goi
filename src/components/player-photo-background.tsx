import escudoAsset from "@/assets/escudo-bzg.png.asset.json";

/** Decorative layers only: the player image is rendered above them. */
export function PlayerPhotoBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 player-photo-background">
      <img
        src={escudoAsset.url}
        alt=""
        className="absolute left-1/2 top-1/2 h-3/4 w-3/4 -translate-x-1/2 -translate-y-1/2 object-contain"
      />
    </div>
  );
}