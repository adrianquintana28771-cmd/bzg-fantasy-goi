import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
  alternatives?: Record<string, Partial<Record<Rareza, string[]>>>;
};

export function imageFormat(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  const mime: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", avif: "image/avif" };
  return extension && mime[extension] ? { extension, contentType: mime[extension] } : null;
}

export function preferredImageFile(current: File | undefined, incoming: File) {
  const rank = (name: string) => /\.webp$/i.test(name) ? 0 : /\.png$/i.test(name) ? 1 : 2;
  return !current || rank(incoming.name) < rank(current.name) ? incoming : current;
}

export async function fetchCardImages(): Promise<CardImages> {
  const { data, error } = await supabase.from("player_card_images").select("player_id,rareza,path,updated_at");
  if (error) throw error;
  const rows = data ?? [];
  const bucket = supabase.storage.from(CARD_BUCKET);
  const ids = [...new Set(rows.map((r) => r.player_id))];
  // Inspect existing objects, not guessed signed URLs (missing objects can still be signed).
  const folders = new Map(await Promise.all(ids.map(async (id) => {
    const { data: files } = await bucket.list(id, { limit: 100 });
    return [id, new Set((files ?? []).map((f) => `${id}/${f.name}`))] as const;
  })));
  const candidates = new Map<string, string[]>();
  for (const r of rows) {
    const rz = r.rareza as Rareza;
    const base = `${r.player_id}/${FILE_OF[rz]}`;
    const files = folders.get(r.player_id);
    const formats = [`${base}.webp`, `${base}.png`, `${base}.jpeg`, `${base}.jpg`].filter((path) => files?.has(path));
    candidates.set(`${r.player_id}:${rz}`, [...new Set([...formats, r.path])]);
  }
  const { data: templateFiles } = await bucket.list("templates", { limit: 100 });
  const templateNames = new Set((templateFiles ?? []).map((f) => `templates/${f.name}`));
  const tplCandidates = new Map(RAREZAS.map((rz) => {
    const base = TEMPLATE_PATH[rz].replace(/\.png$/, "");
    return [rz, [`${base}.webp`, `${base}.png`, `${base}.jpeg`, `${base}.jpg`].filter((path) => templateNames.has(path))] as const;
  }));
  const all = [...new Set([...candidates.values(), ...tplCandidates.values()].flat())];
  const { data: signed } = await supabase.storage.from(CARD_BUCKET).createSignedUrls(all, 60 * 60 * 6);
  const url = new Map<string, string>();
  for (const s of signed ?? []) if (s.signedUrl && !s.error && s.path) url.set(s.path, s.signedUrl);
  const alternatives: NonNullable<CardImages["alternatives"]> = {};
  const out: CardImages = { photos: {}, paths: {}, templates: {}, alternatives };
  for (const r of rows) {
    const urls = (candidates.get(`${r.player_id}:${r.rareza}`) ?? []).flatMap((path) => {
      const u = url.get(path);
      return u ? [u] : [];
    });
    (out.paths[r.player_id] ??= {})[r.rareza as Rareza] = r.path;
    if (urls[0]) (out.photos[r.player_id] ??= {})[r.rareza as Rareza] = urls[0];
    (alternatives[r.player_id] ??= {})[r.rareza as Rareza] = urls;
  }
  for (const rz of RAREZAS) {
    const u = (tplCandidates.get(rz) ?? []).map((path) => url.get(path)).find(Boolean);
    if (u) out.templates[rz] = u;
  }
  return out;
}

/** Failed URLs are skipped immediately, then common photo, then the existing placeholder. */
export function usePhotoSource(ci: CardImages | undefined, id: string | null | undefined, rz: Rareza) {
  const [failed, setFailed] = useState<string[]>([]);
  const sources = id ? [...new Set([
    ...(ci?.alternatives?.[id]?.[rz] ?? [ci?.photos[id]?.[rz]]),
    ...(ci?.alternatives?.[id]?.normal ?? [ci?.photos[id]?.normal]),
  ].filter((u): u is string => Boolean(u)))] : [];
  const src = sources.find((u) => !failed.includes(u));
  return { src, onError: () => { if (src) setFailed((previous) => [...previous, src]); } };
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
