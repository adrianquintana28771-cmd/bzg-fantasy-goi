import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  const original = sources.find((u) => !failed.includes(u));
  const src = useWhiteKeyed(original);
  return { src, onError: () => { if (original) setFailed((previous) => [...previous, original]); } };
}

/* ---------- Display-only removal of a flat white/grey photo background (stored files untouched) ---------- */
const keyedCache = new Map<string, Promise<string>>();
const isOpaqueFormat = (u: string) => /\.(jpe?g)(\?|$)/i.test(u.split("?")[0] + "?");

function keyWhite(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => resolve(url);
    img.onload = () => {
      try {
        const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(url);
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        const px = data.data;
        // Background colour = median-ish of the four corners.
        const corners = [0, w - 1, (h - 1) * w, h * w - 1].map((i) => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
        const bg = [0, 1, 2].map((c) => corners.map((k) => k[c]).sort((a, b) => a - b)[1]);
        if (Math.min(...bg) < 170) return resolve(url); // not a light flat background
        const dist = (i: number) => {
          const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          return sat > 30 ? 999 : Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2]));
        };
        const TOL = 38;
        const mark = new Uint8Array(w * h);
        const stack: number[] = [];
        const push = (i: number) => { if (!mark[i] && dist(i) <= TOL) { mark[i] = 1; stack.push(i); } };
        for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
        for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
        while (stack.length) {
          const i = stack.pop()!;
          const x = i % w, y = (i / w) | 0;
          if (x > 0) push(i - 1);
          if (x < w - 1) push(i + 1);
          if (y > 0) push(i - w);
          if (y < h - 1) push(i + w);
        }
        for (let i = 0; i < w * h; i++) {
          if (mark[i]) { px[i * 4 + 3] = 0; continue; }
          // Soften the silhouette edge next to removed background.
          const x = i % w, y = (i / w) | 0;
          const nearBg = (x > 0 && mark[i - 1]) || (x < w - 1 && mark[i + 1]) || (y > 0 && mark[i - w]) || (y < h - 1 && mark[i + w]);
          if (nearBg) {
            const d = dist(i);
            if (d < 90) px[i * 4 + 3] = Math.round(255 * Math.min(1, (d - TOL) / (90 - TOL) + 0.35));
          }
        }
        ctx.putImageData(data, 0, 0);
        canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : url), "image/png");
      } catch {
        resolve(url); // e.g. CORS-tainted canvas: keep the original photo
      }
    };
    img.src = url;
  });
}

function cacheKey(u: string) {
  return u.split("?")[0];
}

/** Returns a background-free version of opaque (JPEG) photos; transparent formats pass through. */
export function useWhiteKeyed(url: string | undefined) {
  const [done, setDone] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!url || !isOpaqueFormat(url) || done[url]) return;
    const key = cacheKey(url);
    let p = keyedCache.get(key);
    if (!p) { p = keyWhite(url); keyedCache.set(key, p); }
    let alive = true;
    p.then((out) => { if (alive) setDone((prev) => ({ ...prev, [url]: out })); });
    return () => { alive = false; };
  }, [url, done]);
  if (!url) return undefined;
  if (!isOpaqueFormat(url)) return url;
  return done[url]; // undefined while processing: the decorative background shows meanwhile
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

/** Leave a visible frame of the shared background without blending or tinting the photo. */
export function photoBlendClass(_src?: string | null) {
  return "z-10 scale-[0.88]";
}
