import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CARD_BUCKET = "player-card-images";
export type Rareza = "normal" | "raro" | "legendario";
export const RAREZAS: Rareza[] = ["normal", "raro", "legendario"];
/** Nombre de archivo según rareza interna (normal = común). */
export const FILE_OF: Record<Rareza, string> = { normal: "comun", raro: "raro", legendario: "legendario" };
export const TEMPLATE_PATH: Record<Rareza, string> = {
  normal: "templates/ficha_comun.png",
  raro: "templates/ficha_raro.png",
  legendario: "templates/ficha_legendario.png",
};

export type CardImages = {
  /** club_player_id -> rareza -> url firmada */
  photos: Record<string, Partial<Record<Rareza, string>>>;
  paths: Record<string, Partial<Record<Rareza, string>>>;
  templates: Partial<Record<Rareza, string>>;
};

export async function fetchCardImages(): Promise<CardImages> {
  const { data, error } = await supabase.from("player_card_images").select("player_id,rareza,path,updated_at");
  if (error) throw error;
  const rows = data ?? [];
  const tplPaths = Object.values(TEMPLATE_PATH);
  const all = [...rows.map((r) => r.path), ...tplPaths];
  const { data: signed } = await supabase.storage.from(CARD_BUCKET).createSignedUrls(all, 60 * 60 * 6);
  const url = new Map<string, string>();
  for (const s of signed ?? []) if (s.signedUrl && !s.error && s.path) url.set(s.path, s.signedUrl);
  const out: CardImages = { photos: {}, paths: {}, templates: {} };
  for (const r of rows) {
    const u = url.get(r.path);
    (out.paths[r.player_id] ??= {})[r.rareza as Rareza] = r.path;
    if (u) (out.photos[r.player_id] ??= {})[r.rareza as Rareza] = u;
  }
  for (const rz of RAREZAS) {
    const u = url.get(TEMPLATE_PATH[rz]);
    if (u) out.templates[rz] = u;
  }
  return out;
}

export function useCardImages() {
  return useQuery({ queryKey: ["card-images"], queryFn: fetchCardImages, staleTime: 1000 * 60 * 30 });
}

/** Foto de la rareza, si no la común, si no null (placeholder). */
export function photoFor(ci: CardImages | undefined, clubPlayerId: string | null | undefined, rz: Rareza) {
  if (!ci || !clubPlayerId) return null;
  const p = ci.photos[clubPlayerId];
  return p?.[rz] ?? p?.normal ?? null;
}
