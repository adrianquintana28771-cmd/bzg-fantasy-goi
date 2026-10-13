import { cn } from "@/lib/utils";
import { displayPts } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { usePhotoSource, type CardImages } from "@/lib/card-images";
import { PlayerPhotoBackground } from "@/components/player-photo-background";
import escudoAsset from "@/assets/escudo-bzg.png.asset.json";
import type { Database } from "@/integrations/supabase/types";

export type Posicion = Database["public"]["Enums"]["plantilla_posicion"];
export type Rareza = "normal" | "raro" | "legendario";

export const MAX_USOS = 3;

export const RAREZA_MULT: Record<Rareza, number> = { normal: 1, raro: 1.3, legendario: 1.5 };
export const RAREZA_LABEL_ES: Record<Rareza, string> = { normal: "Normal", raro: "Raro", legendario: "Legendario" };
export const RAREZA_LABEL_EU: Record<Rareza, string> = {
  normal: "Normala",
  raro: "Bitxia",
  legendario: "Legendarioa",
};

export const fmtMult = (m: number) => `×${String(m).replace(".", ",")}`;
const fmtPts = (n: number) => displayPts(n);

/** Muestra base de la jornada · multiplicador de rareza → total final (solo visual) */
export function PuntosRareza({
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

export const POS_SHORT: Record<Posicion, string> = {
  portero: "PT",
  extremo_izq: "EI",
  extremo_der: "ED",
  lateral_izq: "LI",
  lateral_der: "LD",
  central: "C",
  pivote: "P",
  entrenador: "ENT",
};

export interface PoolRow {
  id: string;
  nombre: string;
  posicion: Posicion;
  rating: number;
  rareza: Rareza;
  club_player_id?: string | null;
  team_id?: string | null;
  estado?: "disponible" | "dudoso" | "no_disponible";
  club_teams?: { nombre: string } | null;
}

/** Foto de la carta: mismo origen para sobres, selector y campo */
export function CardPhoto({
  className = "",
  images,
  pool,
  name,
}: {
  className?: string;
  images?: CardImages;
  pool?: PoolRow;
  name?: string;
}) {
  const { src, onError } = usePhotoSource(images, pool?.club_player_id, pool?.rareza ?? "normal");
  if (src) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <PlayerPhotoBackground />
        <img
          src={src}
          onError={onError}
          alt={name ?? ""}
          className={cn("relative h-full w-full object-cover object-top", photoBlendClass(src))}
        />
      </div>
    );
  }
  return (
    <img src={escudoAsset.url} alt="" aria-hidden="true" className={cn("h-full w-full object-contain", className)} />
  );
}

/** Existing template's right half and its photo aperture, shared by inventory and picker. */
export function EquipoCard({
  pool, images, posiciones, usos, total, puntos, media,
}: {
  pool: PoolRow;
  images?: CardImages;
  posiciones: Posicion[];
  usos?: number;
  total?: number;
  puntos: number;
  media?: number;
}) {
  const t = useT();
  const template = images?.templates[pool.rareza];
  const nombre = pool.nombre.trim().split(/\s+/).slice(0, 2).join(" ");
  return (
    <div className="relative aspect-[518/763] w-full overflow-hidden rounded-lg border border-border bg-card text-left text-primary-foreground">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {template && (
          <img src={template} alt="" className="absolute -left-[112.4%] top-0 h-full w-[218.3%] max-w-none" />
        )}
        <CardPhoto
          images={images}
          pool={pool}
          name={pool.nombre}
          className="absolute left-[7.7%] top-[15.6%] h-[31.5%] w-[34%] [clip-path:polygon(0_8%,10%_4%,25%_1%,50%_0,75%_1%,90%_4%,100%_8%,100%_79%,50%_100%,0_79%)]"
        />
      </div>
      <div translate="no" title={pool.nombre} className="absolute inset-x-[7%] top-[4%] break-words text-xs font-semibold">{nombre}</div>
      <div className="absolute left-[46%] right-[5%] top-[21%] flex min-w-0 flex-col gap-2 bg-card p-1 text-card-foreground">
        {pool.club_teams?.nombre && <div translate="no" className="break-words text-[10px]">{pool.club_teams.nombre}</div>}
        <div className="break-words text-[10px] uppercase">{posiciones.map((p) => POS_SHORT[p]).join(" · ")}</div>
      </div>
      <div className="absolute inset-x-[7%] top-[49%] flex min-w-0 flex-col gap-1 rounded bg-card/95 p-2 text-xs text-card-foreground">
        <div className="text-[10px] font-bold uppercase">
          {t(RAREZA_LABEL_EU[pool.rareza], RAREZA_LABEL_ES[pool.rareza])} {fmtMult(RAREZA_MULT[pool.rareza])}
          {(total ?? 0) > 1 && <span className="ml-1">x{total}</span>}
        </div>
        {pool.estado && pool.estado !== "disponible" && (
          <div className={pool.estado === "dudoso" ? "text-warning" : "text-destructive"}>
            {pool.estado === "dudoso" ? t("Zalantzazkoa", "Dudoso") : t("Ez eskuragarri", "No disponible")}
          </div>
        )}
        {usos !== undefined && (
          <div className={cn("text-[10px] font-semibold", usos <= 1 ? "text-destructive" : "text-muted-foreground")}>
            {t("Geratzen diren erabilerak", "Usos restantes")}: {usos}/{MAX_USOS}
          </div>
        )}
        <div className="text-[10px] font-semibold">
          <div className="text-muted-foreground">{t("Jardunaldia", "Jornada")}:</div>
          <PuntosRareza base={puntos} rareza={pool.rareza} />
        </div>
        {media !== undefined && (
          <div className="text-[10px] text-muted-foreground">
            {t("Batez bestekoa", "Media")}: <span className="font-semibold text-foreground">{displayPts(media)} pts</span>
          </div>
        )}
      </div>
    </div>
  );
}
